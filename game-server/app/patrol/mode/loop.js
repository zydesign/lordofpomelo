var patrol = require('../patrol');

/**
 * Loop mode: move the character around the path.
 *
 * @param opts
 *        opts.character {Character} current character
 *        opts.path {Array} pos array
 *        opts.rounds {Number} loop rounds. -1 stands for infinite loop
 *        opts.standTick {Number} rest tick after per step. 0 stands for no rest
 */
// 巡逻模式
var Mode = function(opts) {
  this.character = opts.character;          //角色实体
  this.path = opts.path.slice(0);           //去掉角色自身坐标，剩余3个巡逻坐标
  this.rounds = opts.rounds || 1;           //循环圈数，参数提供是-1（-1是无限循环）
  this.step = this.path.length;             //步数，坐标数量
  this.standTick = opts.standTick || 0;     //停留时间
  this.tick = this.standTick;
  this.started = false;                     //是否开始
};

module.exports = Mode;

var pro = Mode.prototype;



//patrolManager.update就是遍历巡逻动作组，执行巡逻动作的update
pro.update = function() {
  //如果路径无坐标或循环圈数为0，返回完成，不再执行后面，等待下一次update
  if(this.path.length === 0 || this.rounds === 0) {
    //if path is empty or rounds is 0
    return patrol.RES_FINISH;
  }

  //如果循环模式未开启
  if(!this.started) {
    //开启循环
    this.started = true;
    //提取第一个巡逻坐标生成寻路路径，发射move事件，生成移动动作，返回等待，不再执行后面，等待下一次update-- ------------------------移动
    this.character.move(this.path[0].x, this.path[0].y, true);
    return patrol.RES_WAIT;
  }

  //到达的坐标
  var dest = this.path[0];
  //如果角色还没到达第一个巡逻坐标，返回等待，不再执行后面，等待下一次update
  //【移动动作move.update会一直更新{character.x,character.y}坐标，直到完成一个寻路路径，才能到达一个巡逻坐标】--------------------
  if(this.character.x !== dest.x || this.character.y !== dest.y) {
    //if i am on the road to dest
    return patrol.RES_WAIT;
  }

  //停留时间大于0，减1，返回等待，不再执行后面，等待下一次update
  if(this.tick > 0) {
    //well, we have finished a step and we can have a rest if necessary
    this.tick--;
    return patrol.RES_WAIT;
  }
  //停留时间归零后，重置停留时间，继续执行后面
  this.tick = this.standTick;

  //如果巡逻圈数大于0，步数减1（如果减1后，步数step为0了，圈数减1；如果圈数rounds也为0了，返回完成，不再执行后面，等待下一次update）
  if(this.rounds > 0) {
    //if we should count the steps and rounds
    this.step--;
    if(this.step === 0) {
      this.rounds--;
      if(this.rounds === 0) {
        return patrol.RES_FINISH;
      }
      //如果步数走完，圈数还有，重置步数step，并执行后面
      this.step = this.path.length;
    }
  }
   //如果去掉原始坐标的路径长度大于1，将走过的那个坐标放到末尾..................
  if(this.path.length > 1) {
    this.path.push(this.path.shift());
  }

  //move to next destination
  //然后角色移动到下一个坐标，返回等待-------------------------------------------------------------------移动
  this.character.move(this.path[0].x, this.path[0].y, true);
  return patrol.RES_WAIT;
};
