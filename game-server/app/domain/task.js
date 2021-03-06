/**
 * Module dependencies
 */

var util = require('util');
var Persistent = require('./persistent');
var TaskState = require('../consts/consts').TaskState; 
var taskData = require('../util/dataApi').task;             //从表里获取任务组

/**
 * Initialize a new 'Task' with the given 'opts'.
 * Task inherits Persistent
 *
 * @param {Object} opts
 * @api public
 */

//（dao/taskDao的createNewTask调用该函数）玩家接取任务，就会在数据库插入新任务数据，并实例 task
//area/handler/taskHandler.startTask会调用Player.startTask,提供task属性taskState、startTime、taskData，并同步到数据库
//参数opts为：{id: res.insertId,playerId: playerId,kindId: kindId}
var Task = function(opts) {
	this.id = opts.id;                                    //数据库的任务id，作为管理类任务组的key
	this.playerId = opts.playerId;                        //拥有该任务的玩家id
	this.kindId = opts.kindId;                            //任务表的任务id
	
	//下面3个属性刚实例时为null，是通过Player.startTask赋值
	this.taskState = opts.taskState;                      //任务的完成状态（开始、未完成、完成没发送、完成）
	this.startTime = opts.startTime;                      //开始执行时间
	this.taskData = this._parseJson(opts.taskData);       //任务数据。实例task时，opt没有提供taskData属性，该函数生成了空对象{}

	this._initTaskInfo();                          //读取任务表单获取对应id的任务，执行初始化任务信息
};
util.inherits(Task, Persistent);   //继承Persistent的原型链

/**
 * Expose 'Task' constructor
 */

module.exports = Task;

/**
 * Init task information form taskList.
 *
 * @api private
 */

Task.prototype._initTaskInfo = function() {
	var info = taskData.findById(this.kindId);   //通过任务表单获取指定id的任务
	
	//读取任务的内容为属性
	if (!!info) {
		this.name = info.name;
		this.heroLevel = info.heroLevel;
		this.desc = info.desc;
		this.acceptTalk = info.acceptTalk;
		this.workTalk = info.workTalk;
		this.finishTalk = info.finishTalk;
		this.exp = info.exp;
		this.item = info.item;  //这里的item不是道具实体，是道具id的字符串
		this.timeLimit = info.timeLimit;
		this.type = info.type;
		 //任务条件，需要JSON.parse一下，这个不明所以，参考空空西游的
		this.completeCondition = this._parseJson(info.completeCondition); 
	}
};

/**
 * Parse String to json.
 *
 * @param {String} data
 * @return {Object}
 * @api private
 */

Task.prototype._parseJson = function(data) {
	//如果没有定义该参数，则参数定义为空对象
	if (typeof data === 'undefined') {
		data = {};
	} else {
		data = JSON.parse(data);
	}
	return data;
};
