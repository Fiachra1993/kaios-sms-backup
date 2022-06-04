# KaiOS SMS Backup

## Overview

Simple app for KaiOS devices to back up SMS and MMS messages to your phone's default storage (internal or SD card). This app is designed for those who want to keep a record/archive of their text messages. There is no "restore" functionality, nor does it (deliberately) export messages into a format used by e.g. Android SMS backup and restore apps.

I developed this app primarily for myself and have made it public in case others find it useful. I do not really intend to develop it any further.

Tested on KaiOS 2.5.1.1 but with only a small number of messages.

## Backup
### Location
Messages are backed up to a directory under /sms-backup. Each backup will have its own directory with the current time and date as its name.

```
$ tree sms-backup/
sms-backup/
└── 2022-05-02_19-50-46.404Z
    ├── mms
    │   ├── 00000
    │   │   ├── IMG_0001.jpg
    │   │   ├── metadata.json
    │   │   └── text_0.txt
    │   ├── 00001
    │   │   └── metadata.json
    │   ├── 00002
    │   │   ├── IMG_0002.jpg
    │   │   ├── metadata.json
    │   │   └── text_0.txt
    │   ├── 00003
    │   │   ├── IMG_0003.jpg
    │   │   ├── metadata.json
    │   │   └── text_0.txt
    │   └── summary.csv
    └── sms-messages-0.csv
```

### Format
#### SMS
Example:
```
type,id,threadId,iccId,delivery,deliveryStatus,sender,receiver,body,messageClass,timestamp,sentTimestamp,deliveryTimestamp,read
sms,1,1,0000000000000000000,sent,not-applicable,,00000000000,Test Text #1,normal,1651432530255,1651432530980,0,true
sms,2,1,0000000000000000000,received,success,+440000000000,,Test Text #2,normal,1651491930100,1651491930800,0,true
```

#### MMS
`summary.csv`:
```
directory,sender,subject,timestamp,timestampFormatted,sentTimestamp,sentTimestampFormatted
00000,,,1651428000500,2022-05-01T18:00:00.500Z,1651428005500,2022-05-01T18:00:05.500Z
00001,+447925120643,,1651428007500,2022-05-01T18:00:07.500Z,0,1970-00-01T00:00:00.000Z
```

`metadata.json`:
```
{
  "type": "mms",
  "id": 3,
  "threadId": 1,
  "iccId": "0000000000000000000",
  "delivery": "sent",
  "deliveryInfo": [
    {
      "deliveryStatus": "not-applicable",
      "deliveryTimestamp": 0,
      "readStatus": "not-applicable",
      "readTimestamp": 0,
      "receiver": "00000000000"
    }
  ],
  "sender": "",
  "receivers": [
    "00000000000"
  ],
  "timestamp": 1651428000500,
  "sentTimestamp": 1651428005500,
  "read": true,
  "subject": "",
  "smil": "<smil><head><layout><root-layout width=\"320px\" height=\"480px\"/><region id=\"Image\" left=\"0px\" top=\"0px\" width=\"320px\" height=\"320px\" fit=\"meet\"/><region id=\"Text\" left=\"0px\" top=\"320px\" width=\"320px\" height=\"160px\" fit=\"meet\"/></layout></head><body><par dur=\"5000ms\"><img src=\"IMG_0001.jpg\" region=\"Image\"/><text src=\"text_0.txt\" region=\"Text\"/></par></body></smil>",
  "expiryDate": 0,
  "readReportRequested": false,
  "attachments": [
    {
      "id": "<IMG_0001.jpg>",
      "location": "IMG_0001.jpg"
    },
    {
      "id": "<text_0.txt>",
      "location": "text_0.txt"
    }
  ]
}
```

## Permissions

Type: `certified`

Only `certified` apps can access the messaging API

Permissions:
- `sms` for reading SMS and MMS messages
- `storage` and `device-storage:sdcard` (`readwrite`) for writing messages to internal or SD card storage