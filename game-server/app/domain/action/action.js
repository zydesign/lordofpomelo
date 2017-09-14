var id = 1;

/**
 * Action class, used to excute the action in server
 *Action类，用于在服务器中执行动作
 */
var Action = function(opts){
	this.data = opts.data;
	this.id = opts.id || id++;
	this.type = opts.type || 'defaultAction';  //动作类型
	
	this.finished = false; //完成
	this.aborted = false;  //停止
	this.singleton = false || opts.singleton;  //单个动作
};

/**
 * Update interface, default update will do nothing, every tick the update will be invoked
 * @api public
 *更新接口，默认更新不会执行任何操作，每次更新都会被调用
 */
Action.prototype.update = function(){
};

module.exports = Action;
