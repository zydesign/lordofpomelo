var patrol = require('../patrol');

//复合模式：添加子巡逻模式组，
/**
 * Composite mode: compose children and invoke them one by one.
 */
var Mode = function() {
  this.children = [];
  this.index = 0;
};

module.exports = Mode;

var pro = Mode.prototype;

pro.add = function(mode) {
  this.children.push(mode);
};


//这个update是半闭包。一个一个执行子模式的update，有等待则等待，则退出闭包等下一次刷新，直到子模式返回完成，才会执行下一个子模式
//（只有子模式返回等待，退出闭包等下一次刷新，或者子模式全部完成也退出闭包）
pro.update = function() {
  //如果所有子模式的update都返回RES_FINISH，就会index===length，就会返回成功，退出闭包
  if(this.index >= this.children.length) {
    return patrol.RES_FINISH;
  }

  var child = this.children[this.index];
  var res = child.update();
  if(res === patrol.RES_WAIT) {
    return res;
  }

  this.index++;
  return this.update();
};
