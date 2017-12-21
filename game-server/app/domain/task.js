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

var Task = function(opts) {
	this.id = opts.id;                                    //任务id，作为管理类任务组的key
	this.playerId = opts.playerId;                        //拥有该任务的玩家id
	this.kindId = opts.kindId;                            //任务的类型id
	this.taskState = opts.taskState;                      //任务的完成状态（开始、未完成、完成没发送、完成）
	this.startTime = opts.startTime;                      //开始执行时间
	this.taskData = this._parseJson(opts.taskData);       //任务数据

	this._initTaskInfo();                          //执行初始化任务信息
};
util.inherits(Task, Persistent);

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
	var info = taskData.findById(this.kindId);   //获取指定id的任务对象
	
	//读取任务的内容为属性
	if (!!info) {
		this.name = info.name;
		this.heroLevel = info.heroLevel;
		this.desc = info.desc;
		this.acceptTalk = info.acceptTalk;
		this.workTalk = info.workTalk;
		this.finishTalk = info.finishTalk;
		this.exp = info.exp;
		this.item = info.item;
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
	if (typeof data === 'undefined') {
		data = {};
	} else {
		data = JSON.parse(data);
	}
	return data;
};
