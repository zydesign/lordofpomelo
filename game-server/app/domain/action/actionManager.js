var Queue = require('pomelo-collection').queue;
var logger = require('pomelo-logger').getLogger(__filename);

/**
 * Action Manager, which is used to contrll all action
 *动作管理器，用来控制所有动作
 */

//在area类引入actionManager作为属性，提供opt参数
var ActionManager = function(opts){
	opts = opts||{};
	
	this.limit = opts.limit||10000;
	
	//The map used to abort or cancel action, it's a two level map, first leven key is type, second leven is id
	//动作图阵
	this.actionMap = {};
	
	//The action queue, default size is 10000, all action in the action queue will excute in the FIFO order
	//行动队列,默认大小是10000,所有行动的行动队列将执行 FIFO秩序
	this.actionQueue = new Queue(this.limit);
}; 

/**
 * Add action 
 * @param {Object} action  The action to add, the order will be preserved
 * 先把动作添加都动作图阵里面，并返回排列过的数组
 */
ActionManager.prototype.addAction = function(action){
	if(action.singleton) {
		this.abortAction(action.type, action.id);
	}
		
	this.actionMap[action.type] = this.actionMap[action.type]||{};
	
	this.actionMap[action.type][action.id] = action;	
	
	return this.actionQueue.push(action);
};

/**
 * abort an action, the action will be canceled and not excute
 * @param {String} type Given type of the action
 * @param {String} id The action id
 *中止一个动作，该动作将被取消，并删除
 */
ActionManager.prototype.abortAction = function(type, id){
	if(!this.actionMap[type] || !this.actionMap[type][id]){
		return;
	}
	
	this.actionMap[type][id].aborted = true;
	delete this.actionMap[type][id];
};

/**
 * Abort all action by given id, it will find all action type
 *根据给定的id终止所有动作，它会找到所有的动作类型
 */
ActionManager.prototype.abortAllAction = function(id){
	for(var type in this.actionMap){
		if(!!this.actionMap[type][id]) {
			this.actionMap[type][id].aborted = true;
		}
	}
};

/**
 * Update all action
 * @api public
 *更新所有的动作
 */
ActionManager.prototype.update = function(){
	var length = this.actionQueue.length;
	
	for(var i = 0; i < length; i++){
		//pop() 方法用于删除并返回数组的最后一个元素
		var action = this.actionQueue.pop();
	
		if(action.aborted){
			continue;
		}
			
		action.update();
		if(!action.finished){
			this.actionQueue.push(action);
		}else{
			delete this.actionMap[action.type][action.id];
		}
	}
};	

module.exports = ActionManager;
