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

    this.video.addEventListener('play', this.onPl);
  }

  start () {
    //Putting this in a start method, since we might need to add event listener again if video ends, and we want to restart it.
    this.video.addEventListener('play', this.onPl);
  }

  onPlay () {
    //This listener is executed only on the first 'play' event (it auto removes just below). At the first play event we don't have any data in buffer.
    this.state = this.BUFFERING;
    this.emit(Event.WAITING);

    this.tickInterval = setInterval(this.tick.bind(this), 100);

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

    // Set back 'play' listener on video, incase video restarts
    //TODO: this needs to be cleared in a 'dispose' method
    this.video.addEventListener('play', this.onPl);
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

    if (this.isLive !== undefined && !this.isLive && this.video.duration && this.video.duration  - this.video.currentTime < 0.5) {
      this.onEnded();
      return;
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