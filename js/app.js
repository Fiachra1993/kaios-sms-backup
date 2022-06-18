window.onerror = function(msg, url, line) {
	var alertMsg = 'Message: [' + msg + '], URL: [' + url + '], Line Number: [' + line + ']';
	DEBUG && console.error(alertMsg);
	alert(alertMsg);
}

var __app = (function() {
var DEBUG = false;
var NEW_LINE = '\r\n';

var TYPE_SMS = 'sms';
var TYPE_MMS = 'mms';
var TYPES = [TYPE_SMS, TYPE_MMS];

var BACKUP_DIR_NAME = 'sms-backup';

var Util = (function() {
	function upper(value) {
		if (typeof value === 'string') {
			return value.toUpperCase();
		}
		return value;
	}
	
	// https://github.com/apache/commons-lang/blob/master/src/main/java/org/apache/commons/lang3/StringEscapeUtils.java
	var CSV_SEARCH_CHARS = [',', '"', '\r', '\n'];
	function escapeForCsv(value) {
		if (value == null) return '';
		var needsEscape = false;
		for (var i = 0; i < CSV_SEARCH_CHARS.length; i++) {
			if (value.includes(CSV_SEARCH_CHARS[i])) {
				needsEscape = true;
				break;
			}
		}
		
		if (needsEscape) {
			return '"' + value.replace(/"/g, '""') + '"';
		} else {
			return value;
		}
	}

	function csvHeaderForObject(obj) {
		return csvHeaderForKeys(Object.keys(obj));
	}
	
	function csvHeaderForKeys(keys) {
		var header = '';
		if (keys != null) {
			for (var i = 0; i < keys.length; i++) {
				header += escapeForCsv(keys[i]) + ',';
			}
		}
		
		if (header.length > 0) {
			return header.substr(0, header.length - 1);
		} else {
			return header;
		}
	}

	function csvRow(obj, keys) {
		var row = '';
		if (obj != null) {
			for (var i = 0; i < keys.length; i++) {
				var value = obj[keys[i]];
				var csvValue;
				if (value == null) {
					csvValue = '';
				} else if (typeof value === 'string') {
					csvValue = escapeForCsv(value);
				} else {
					csvValue = escapeForCsv(JSON.stringify(value));
				}
				
				row += csvValue + ',';
			}
		}
		
		if (row.length > 0) {
			return row.substr(0, row.length - 1);
		} else {
			return row;
		}
	}
	
	var pendingWrites = 0;
	
	function doBlobWrite(fileName, blob) {
		var storage = navigator.getDeviceStorage('sdcard');
		
		var request = storage.addNamed(blob, fileName);
		++pendingWrites;
		
		request.onsuccess = function () {
			--pendingWrites;
			var name = this.result;
			DEBUG && console.log('File written: ' + name);
		}

		request.onerror = function () {
			--pendingWrites;
			appendToOutput('Unable to write file "' + fileName + '": ' + this.error.name + ': ' + this.error.message, 'error');
		}
	}
	
	function writeStringToFile(fileName, content) {
		DEBUG && console.log(fileName + ':' + content.length + ':');
		DEBUG && console.log(content);
		
		var blob = new Blob([content], {type: "text/plain"});
		doBlobWrite(fileName, blob);
	}
	
	function writeBlobToFile(fileName, content) {
		DEBUG && console.log(fileName + ':' + content.size);
		
		doBlobWrite(fileName, content);
	}
	
	function leftPadZero(value, padCount) {
		var n = Math.pow(10, padCount);
		return ('' + (n + value)).substr(1);
	}
	
	// e.g. "2022-06-01T22:02:48.250Z"
	function epochTimestampToUtcFormattedDate(timestamp) {
		var date = new Date(timestamp);
		return leftPadZero(date.getUTCFullYear(), 4) + '-' + leftPadZero(date.getUTCMonth() + 1, 2) + '-' + 
			leftPadZero(date.getUTCDate(), 2) + 'T' + leftPadZero(date.getUTCHours(), 2) + ':' + 
			leftPadZero(date.getUTCMinutes(), 2) + ':' + leftPadZero(date.getUTCSeconds(), 2) + '.' + 
			leftPadZero(date.getUTCMilliseconds(), 3) + 'Z';
	}
	
	// e.g. "2022-06-01_22-02-48.250Z"
	function epochTimestampToUtcFileSafeFormattedDate(timestamp) {
		return epochTimestampToUtcFormattedDate(timestamp).replace(/T/g, '_').replace(/:/g, '-');
	}
	
	return {
		upper: upper,
		escapeForCsv: escapeForCsv,
		csvHeaderForKeys: csvHeaderForKeys,
		csvHeaderForObject: csvHeaderForObject,
		csvRow: csvRow,
		writeStringToFile: writeStringToFile,
		writeBlobToFile: writeBlobToFile,
		getPendingWriteCount: function() {
			return pendingWrites;
		},
		leftPadZero: leftPadZero,
		epochTimestampToUtcFormattedDate: epochTimestampToUtcFormattedDate,
		epochTimestampToUtcFileSafeFormattedDate: epochTimestampToUtcFileSafeFormattedDate
	};
})();

var UI = (function() {
	var elOutput = document.getElementById('output');
	var elRun = document.getElementById('run');
	var elEnableSms = document.getElementById('sms-enable');
	var elEnableMms = document.getElementById('mms-enable');
	
	function clearOutput() {
		elOutput.innerHTML = '';
	}

	function appendToOutput(value, classes) {
		elOutput.innerHTML += '<p class="item ' + (classes || '') + '" tabindex="0">' + value + '</p>';
	}
	
	var NAV_ALLOW_LOOP_AROUND = true;
	
	function nav(move) {
		const items = document.querySelectorAll('.item');

		currentIndex = 0;
		for (var i = 0; i < items.length; i++) {
			if (items[i] == document.activeElement) {
				currentIndex = i;
				break;
			}
		}
		var next;
		if (NAV_ALLOW_LOOP_AROUND) {
			move = move % items.length;
			next = (currentIndex + move) % items.length;
			if (next < 0) {
				next += items.length;
			}
		} else {
			next = Math.min(currentIndex + move, items.length - 1);
		}
		var finalIdx;
		for (var i = 0; i < items.length; i++) {
			var idx = (next + i) % items.length;
			var item = items[idx];
			if (item.getAttribute('disabled') == null) {
				finalIdx = idx;
				item.focus();
				item.scrollIntoView(false);
				break;
			}
		}
		if (finalIdx === 0) {
			window.scrollBy(0, -20);
		} else if (finalIdx === items.length - 1) {
			window.scrollBy(0, 20);
		}
	}

	function enter() {
		if (document.activeElement == null) {
			return;
		}
		if (document.activeElement.getAttribute('disabled') != null) {
			return;
		}
		
		if (document.activeElement.classList.contains('input-wrapper')) {
			var input = document.activeElement.children[0];
			input.click();
		} else {
			document.activeElement.click();
		}
	}

	function enableInputWrapper(id) {
		var el = document.getElementById(id);
		if (el == null) return;
		el.setAttribute('tabindex', '0');
		el.removeAttribute('disabled');
		for (var i = 0; i < el.children.length; i++) {
			el.children[i].removeAttribute('disabled');
		}
	}

	function clickOn(id) {
		var el = document.getElementById(id);
		if (el == null) return;
		el.click();
	}
	
	function disableOptions() {
		[elRun, elEnableSms, elEnableSms.parentNode, elEnableMms, elEnableMms.parentNode].forEach((el) => {
			el.setAttribute('disabled', 'disabled');
			el.setAttribute('tabindex', '-1');
		});
		document.body.click();
	}
	
	function reenableOptions() {
		[elRun, elEnableSms, elEnableSms.parentNode, elEnableMms, elEnableMms.parentNode].forEach((el) => {
			el.removeAttribute('disabled');
			el.setAttribute('tabindex', '0');
		});
	}
	
	function isSmsEnabled() {
		return elEnableSms.checked;
	}
	
	function isMmsEnabled() {
		return elEnableMms.checked;
	}
	
	return {
		clearOutput: clearOutput,
		appendToOutput: appendToOutput,
		nav: nav,
		enter: enter,
		enableInputWrapper: enableInputWrapper,
		clickOn: clickOn,
		disableOptions: disableOptions,
		reenableOptions: reenableOptions,
		isSmsEnabled: isSmsEnabled,
		isMmsEnabled: isMmsEnabled,
		
		elRun: elRun
	};
})();

function handleError(error) {
	UI.appendToOutput(error, 'error');
	UI.appendToOutput(error.stack, 'error');
	DEBUG && console.error(error);
}

/*
Example:
type,id,threadId,iccId,delivery,deliveryStatus,sender,receiver,body,messageClass,timestamp,sentTimestamp,deliveryTimestamp,read
sms,1,1,0000000000000000000,sent,not-applicable,,00000000000,Test Text #1,normal,1651432530255,1651432530980,0,true
sms,2,1,0000000000000000000,received,success,+440000000000,,Test Text #2,normal,1651491930100,1651491930800,0,true
*/
function smsDumper() {
	var SMS_BACKUP_FILE_PREFIX = 'sms-messages-';
	var SMS_BACKUP_FILE_SUFFIX = '.csv';
	var SMS_MAX_BACKUP_FILE_LENGTH = 1024 * 512; // string length
	
	var dirName;
	var keys;
	var header;
	var buffer;
	var msgCounter;
	var fileCounter;
	var bufferMsgCounter;
	
	function init(_dirName) {
		dirName = _dirName;
		msgCounter = 0;
		fileCounter = 0;
		bufferMsgCounter = 0;
	}
	
	function nextFileName() {
		return dirName + '/' + SMS_BACKUP_FILE_PREFIX + fileCounter + SMS_BACKUP_FILE_SUFFIX;
	}
	
	function handleMessage(msg) {
		if (msgCounter++ < 1) {
			keys = [];
			for (var k in msg) {
				keys.push(k);
			}
			header = Util.csvHeaderForKeys(keys);
			buffer = header + NEW_LINE;
		}
		
		var row = Util.csvRow(msg, keys);
		
		if (buffer.length + row.length > SMS_MAX_BACKUP_FILE_LENGTH && bufferMsgCounter > 0) {
			var fileName = nextFileName();
			Util.writeStringToFile(fileName, buffer);
			UI.appendToOutput(fileName);
			buffer = header + NEW_LINE;
			fileCounter++;
			bufferMsgCounter = 0;
		}
		
		buffer += row + NEW_LINE;
		bufferMsgCounter++;
	}
	
	function finish() {
		if (msgCounter < 1) {
			UI.appendToOutput(Util.upper(TYPE_SMS) + ': nothing to do');
			return;
		}
		
		if (bufferMsgCounter > 0) {
			var fileName = nextFileName();
			Util.writeStringToFile(fileName, buffer);
			UI.appendToOutput(fileName);
		}
		
		UI.appendToOutput(Util.upper(TYPE_SMS) + ': done, ' + msgCounter + ' message(s) saved');
	}
	
	return {
		init: init,
		handleMessage: handleMessage,
		finish: finish
	}
}

/*
MMS properties: [
	"type", "id", "threadId", "iccId", "delivery", "deliveryInfo", "sender",
	"receivers", "timestamp", "sentTimestamp", "read", "subject", "smil", "attachments",
	"expiryDate", "readReportRequested"
]
MMS attachment properties: ["id", "location", "content"]
*/
function mmsDumper() {
	var dirName;
	var keys;
	var msgCounter;
	var summary;
	
	function init(_dirName) {
		dirName = _dirName;
		msgCounter = 0;
		summary = 'directory,sender,subject,timestamp,timestampFormatted,sentTimestamp,sentTimestampFormatted' + NEW_LINE;
	}
	
	function nextDirName() {
		return Util.leftPadZero(msgCounter, 5);
	}
	
	function summaryLine(msgDirName, msg) {
		return msgDirName + ',' + Util.escapeForCsv(msg.sender) + ',' + Util.escapeForCsv(msg.subject) + ',' +
			msg.timestamp + ',' + Util.escapeForCsv(Util.epochTimestampToUtcFormattedDate(msg.timestamp)) + ',' +
			msg.sentTimestamp + ',' + Util.escapeForCsv(Util.epochTimestampToUtcFormattedDate(msg.sentTimestamp));
	}
	
	function mmsJsonMetaData(msg) {
		if (msg == null) return '';
		
		var obj = {};
		for (var k in msg) {
			if (k === 'attachments') {
				continue;
			}
			obj[k] = msg[k];
		}
		if (msg.attachments != null && msg.attachments.length > 0) {
			obj.attachments = [];
			for (var i = 0; i < msg.attachments.length; i++) {
				var att = msg.attachments[i];
				var attCopy = {};
				for (var k in att) {
					attCopy[k] = att[k];
				}
				delete attCopy.content;
				obj.attachments.push(attCopy);
			}
		}
		
		return JSON.stringify(obj, null, 2);
	}
	
	function handleMessage(msg) {
		var metaDataJson = mmsJsonMetaData(msg);
		
		var msgDirName = nextDirName();
		var msgDirNameFull = dirName + '/mms/' + msgDirName;
		Util.writeStringToFile(msgDirNameFull + '/metadata.json', metaDataJson);
		
		if (msg.attachments != null && msg.attachments.length > 0) {
			for (var i = 0; i < msg.attachments.length; i++) {
				Util.writeBlobToFile(msgDirNameFull + '/' + msg.attachments[i].location, msg.attachments[i].content);
			}
		}
		
		summary += summaryLine(msgDirName, msg) + NEW_LINE;
		
		++msgCounter;
	}
	
	function finish() {
		if (msgCounter < 1) {
			UI.appendToOutput(Util.upper(TYPE_MMS) + ': nothing to do');
			return;
		}
		
		Util.writeStringToFile(dirName + '/mms/summary.csv', summary);
		
		UI.appendToOutput(Util.upper(TYPE_MMS) + ': done, ' + msgCounter + ' message(s) saved');
	}
	
	return {
		init: init,
		handleMessage: handleMessage,
		finish: finish
	}
}

function calculateDirectoryName() {
	var today = new Date();
	var dateTimeStr = Util.epochTimestampToUtcFileSafeFormattedDate(today.getTime());
	return BACKUP_DIR_NAME + '/' + dateTimeStr;
}

function dumpMessages() {
	try {
		var types = [];
		var handlersByType = {};
		if (UI.isSmsEnabled()) {
			types.push(TYPE_SMS);
			handlersByType[TYPE_SMS] = smsDumper();
		}
		if (UI.isMmsEnabled()) {
			types.push(TYPE_MMS);
			handlersByType[TYPE_MMS] = mmsDumper();
		}
		
		if (types.length < 1) {
			alert('No message types selected');
			return;
		}
		
		UI.disableOptions();
		UI.clearOutput();
		
		UI.appendToOutput('Reading: ' + JSON.stringify(types) + ' ... ');
		
		var dirName = calculateDirectoryName();
		DEBUG && console.log('Directory name: ' + dirName);
		UI.appendToOutput('Directory name: ' + dirName);
		
		for (var k in handlersByType) {
			handlersByType[k].init(dirName);
		}

		function each(result) {
			DEBUG && console.log('each');
			DEBUG && console.log(result);

			if (types.includes(result.type)) {
				handlersByType[result.type].handleMessage(result);
			}
		}
		function done() {
			try {
				DEBUG && console.log('done');
				
				for (var k in handlersByType) {
					handlersByType[k].finish();
				}
				
				var doneInterval;
				var doneCheckCount = 0;
				doneInterval = setInterval(function() {
					try {
						if (Util.getPendingWriteCount() < 1 || doneCheckCount > 10) {
							clearInterval(doneInterval);
							UI.appendToOutput('Done');
							UI.reenableOptions();
							UI.nav(0);
						}
						++doneCheckCount;
					} catch (error) {
						handleError(error);
					}
				}, 500);
			} catch (error) {
				handleError(error)
			}
		}
		
		// MozMobileMessageManager.getMessages(filter, reverseOrder)
		var cursor = navigator.mozMobileMessage.getMessages(undefined, false);
		
		cursor.onsuccess = function onsuccess() {
			if (!this.done) {
				each(this.result);
				this.continue();
			} else {
				done();
			}
		};
		cursor.onerror = function onerror() {
			handleError(this.error);
			done();
		};
	} catch (error) {
		handleError(error);
	}
}

window.addEventListener('DOMContentLoaded', function() {

	UI.nav(0);
	
    window.addEventListener('keydown', function(e) {
        switch (e.key) {
			case 'ArrowUp':
				e.preventDefault();
				UI.nav(-1);
				break;
			case 'ArrowDown':
				e.preventDefault();
				UI.nav(1);
				break;
			case 'Enter':
				e.preventDefault();
				UI.enter();
				break;
            default:
                break
        }
    });
	
	UI.elRun.onclick = function() {
		setTimeout(dumpMessages, 0);
	}
}, false);

return {
	toggleDebug: function() {
		DEBUG = !DEBUG;
	}
}
})();