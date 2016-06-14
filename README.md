# video-event-polyfill
Polyfill for unconsistent events of HTML5 video API


## Installation

```sh
npm install --save video-event-polyfill
```

## Build

The dist file is generated with the following command:

```sh
npm run build
```

# Basic Usage

``` js
var polyfill = new VideoEventPolyfill(video);
polyfill.on(VideoEventPolyfill.Events.WAITING, function () {
  // Handle waiting event
});
polyfill.on(VideoEventPolyfill.Events.PLAYING, function () {
  // Handle playing event
});
polyfill.on(VideoEventPolyfill.Events.ENDED, function () {
  //Handle ended event
});
```

# API

### Constructor

Takes a html5 video tag as argument

### Events

Static enum for the events emulated by this polyfill (see [eventStruct.js](https://github.com/streamroot/video-event-polyfill/blob/master/lib/eventStruct.js) )

### on(Event, callback)

Takes an Event from the previous Enum, and a callback

### setLive(true|false)

Inform the polyfill wether the content is live streaming or not. The polyfill won't trigger ENDED if this method hasn't been called, or if the content is live streaming.

### dispose()

Destroy the polyfill
