var patrol = require('../patrol');

/**
 * Wait mode: wait ticks and then return finish.
 */
//等待模式。opt提供等待时间，每update一次tick减1，返回等待下一次update，
var Mode = function(opts) {
  this.tick = opts.tick||1;
};

module.exports = Mode;

var pro = Mode.prototype;

pro.update = function() {
  if(!this.tick) {
    return patrol.RES_FINISH;
  }

  this.tick--;
  return patrol.RES_WAIT;
};
