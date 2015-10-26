import EventEmitter from 'events';
import Event from './eventStruct';

/**
 * This class offers a polyfill for video events that are not consistent, notably when using MSE in chrome, namely:
 *   - waiting
 *   - playing
 *   - ended
 */
class VideoEventPolyfill extends EventEmitter {

  static get Events () {
    return Event;
  }

  constructor (video) {
    super();
    
    this.video = video;

    this.IDLE = 0; // Video either not started, or already ended
    this.BUFFERING =1;
    this.PLAYING = 2;

    this.TOLERANCE = 0.1;

    this.state = this.IDLE;

    var eventEmitter = new EventEmitter();

    // Defining bound function, to be able to remove events listeners (bind returns a new function).
    this.onPl = this.onPlay.bind(this);

    this.onPling = this.onPlaying.bind(this);

    if (this.video.paused) {
        this.start();
    } else {
        this.onPlay();
    }
    
  }

  start () {
    //Putting this in a start method, since we might need to add event listener again if video ends, and we want to restart it.
    this.video.addEventListener('play', this.onPl);
  }

  onPlay () {
    //This listener is executed only on the first 'play' event (it auto removes just below). At the first play event we don't have any data in buffer.
    this.state = this.BUFFERING;
    this.emit(Event.WAITING);

    // Interval is set to 200ms so that currentTime has time to update between 2 calls, which is important for the onEnded check (to avoid false positives for the case where playback is stuck just before the end of the video)
    this.tickInterval = setInterval(this.tick.bind(this), 200);

    this.video.removeEventListener('play', this.onPl);
  }

  onPlaying () {
    this.emit(Event.PLAYING);

    this.video.removeEventListener('playing', this.onPling);
  }

  onEnded () {
    clearInterval(this.tickInterval);
    this.state = this.IDLE;

    this.emit(Event.ENDED);

    // this.video can be undefined here (if there's a post-roll with JW for example)
    if (this.video) {
      // Set back 'play' listener on video, in case video restarts
      this.video.addEventListener('play', this.onPl);
    }
  }

  getBufferLength () {
    for (var i=0; i<this.video.buffered.length; i++) {
      if (this.video.buffered.start(i) <= this.video.currentTime && this.video.currentTime <= this.video.buffered.end(i)) {
        return this.video.buffered.end(i) - this.video.currentTime;
      }
    }
    return 0;
  }

  tick () {

    if (this.isLive !== undefined && !this.isLive) {
      if (this.video.duration && (this.video.duration  - this.video.currentTime < 0.5 ||
                                  // Sometimes playback gets stuck just before duration - 0.5 when JW reattaches the video after post-rolls. Video isn't paused and playbackRate is 1.
                                  (this.video.duration - this.video.currentTime < 1 && this.lastCurrentTime - this.video.currentTime < 0.01 && !this.video.paused && this.video.playbackRate > 0) ||
                                  // video.duration is sometimes NaN with JW after post-rolls
                                  this.video.currentTime > 0 && isNaN(this.video.duration))) {
        this.onEnded();
        return;
      } else {
        this.lastCurrentTime = this.video.currentTime;
      }
    }

    var bufferLength = this.getBufferLength();

    switch(this.state) {
      case this.BUFFERING:
        if (bufferLength > this.TOLERANCE) {
          this.state = this.PLAYING;
          if (!this.video.paused) {
            this.emit(Event.PLAYING);
          } else {
            // If video is paused, we don't want to trigger 'playing' (this is not the expected behavior of the video tag). Add a listener (auto-removes after one execution) to retrigger 'playing' from the video tag (correctly emitted in this case.).
            //TODO: do we wan't to retransmit 'playing'? Are there cases where we have to listne from the tag directly (pause > play with buffer full).
            //TODO: Check browsers bhaviours. When do we need this polyfill, and are there browsers where this doesn't work?
            this.video.addEventListener('playing', this.onPling);
          }
        }
        break;

      case this.PLAYING:
        if (bufferLength < this.TOLERANCE) {
          this.state = this.BUFFERING;
          this.emit(Event.WAITING);
        } else if (this.video.paused) {
            this.video.addEventListener('playing', this.onPling);
        }
        break;


      case this.IDLE: // tick is not supposed to be triggered if we're in IDLE state
      default:
        return;

    }
  }
  
  setLive (isLive) {
    this.isLive = isLive;
  }
  
  dispose () {
    clearInterval(this.tickInterval);
    
    if (this.video) {
      this.video.removeEventListener('play', this.onPl);
      this.video.removeEventListener('playing', this.onPling);
      delete this.video;
    }
    
    this.removeAllListeners();
  }
}

export default VideoEventPolyfill;