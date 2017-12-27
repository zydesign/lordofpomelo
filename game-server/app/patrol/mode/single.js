var patrol = require('../patrol');

/**
 * Single mode: move the character on the path given once.
 *
 * @param opts
 *        opts.character {Character} current character
 *        opts.path {Array} pos array
 */

// 单一模式。所有巡逻坐标只走一次，不循环
var Mode = function(opts) {
  this.character = opts.character;      //角色实体
  this.path = opts.path.slice(0);       //巡逻路径  (怪物空间生成怪物卵时，生成巡逻路径path)
  this.started = false;                 //是否开始
};

module.exports = Mode;

var pro = Mode.prototype;

pro.update = function() {
  //如果巡逻路径为空
  if(this.path.length === 0) {
    //if path is empty
    return patrol.RES_FINISH;
  }

  //如果单一模式没开始，执行角色移动函数，生成第一个巡逻坐标的寻路路径，生成移动动作，返回等待，等待下一次update
  if(!this.started) {
    this.character.move(this.path[0].x, this.path[0].y);
    this.started = true;
    return patrol.RES_WAIT;
  }

  var dest = this.path[0];
  //检测移动动作是否到达巡逻坐标，如果没到达，继续等待下一次update--------------------------------------1
  if(this.character.x !== dest.x || this.character.y !== dest.y) {
    //if i am on the road to dest
    return patrol.RES_WAIT;
  }

  //到达提供的巡逻坐标后，执行巡逻路径去掉第一个坐标（完成的坐标），返回剩下坐标组
  this.path.shift();

  //检测巡逻路径是否清空了
  if(this.path.length === 0) {
    return patrol.RES_FINISH;
  }

  //执行角色移动到下一个巡逻坐标，返回等待下一次刷新，之后到1步骤检测坐标是否到达，
  //move to next destination
  this.character.move(this.path[0].x, this.path[0].y);
  return patrol.RES_WAIT;
};
