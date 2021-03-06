var id = 1;

/**
 * Action class, used to excute the action in server
 *Action类，用于在服务器中执行动作
 */

//move、Revive动作继承这个action的时候，提供opt参数
var Action = function(opts){
	this.data = opts.data;
	this.id = opts.id || id++;  //动作id
	this.type = opts.type || 'defaultAction';  //动作类型
	
	this.finished = false; //完成
	this.aborted = false;  //停止
	this.singleton = false || opts.singleton;  //独立动作
};

/**
 * Update interface, default update will do nothing, every tick the update will be invoked
 * @api public
 *更新接口，默认主类不会执行任何更新操作，而move、Revive有自己的update
 */
Action.prototype.update = function(){
};

module.exports = Action;
