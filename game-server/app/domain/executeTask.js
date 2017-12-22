/**
 * Module dependencies //执行任务模块
 */
var consts = require('../consts/consts');
var messageService = require('./messageService');
var taskData = require('../util/dataApi').task;
var taskDao = require('../dao/taskDao');
var logger = require('pomelo-logger').getLogger(__filename);
var async = require('async');

/**
 * Expose 'executeTask'.
 */
//执行任务，玩家接受任务后，开始执行任务刷怪，收集道具等，更新任务完成进度，推送给客户端
var executeTask = module.exports;

/**
 * Update taskData.
 * when the player kills mob or player, it invokes.
 * if this action occurs in the player's curTask timeLimit, the curTask's taskData will be updated.
 *
 * @param {Player} player, the player of this action
 * @param {Character} killed, the killed character(mob/player)
 * @api public
 */
//玩家击杀怪物后，调用该函数
executeTask.updateTaskData = function(player, killed) {
	//先排除角色类型是怪物
  if (player.type === consts.EntityType.MOB) {return;}
	var tasks = player.curTasks;
	var reData = null;  //记录任务进度数据
	for (var id in tasks) {
		var task = tasks[id];
		//如果无任务或任务完成或任务完成一半，则遍历下一个任务
		if (typeof task === 'undefined' || task.taskState >= consts.TaskState.COMPLETED_NOT_DELIVERY)	{
			continue;
		}
		//任务描述切割为数组
		var taskDesc = task.desc.split(';');
		var taskType = task.type;    //任务类型
		var killedNum = task.completeCondition[taskDesc[1]];  //刷怪数量
		//满足3个条件：任务类型为击杀怪物，被击杀的目标是怪物，被击杀目标的怪物id是描述的第二项
		if (taskType === consts.TaskType.KILL_MOB && killed.type === consts.EntityType.MOB && killed.kindId === parseInt(taskDesc[1])) {
			task.taskData.mobKilled += 1;  //该属性由Player.startTask函数提供
			reData = reData || {};
			reData[id] = task.taskData;
			task.save();   //更新了taskData后，同步数据库
			player.curTasks[id] = task;  //更新角色player的当前任务
			//击杀怪物达到数量时，即任务完成时，执行任务完成函数，推送消息给玩家，完成任务按钮激活
			if (player.curTasks[id].taskData.mobKilled >= killedNum) {
				isCompleted(player, id);
			}
		} else if (taskType === consts.TaskType.KILL_PLAYER && killed.type === consts.EntityType.PLAYER && killed.level >= player.level) {
			task.taskData.playerKilled += 1;
			reData = reData || {};
			reData[id] = task.taskData;
			task.save();
			player.curTasks[id] = task;
			if (player.curTasks[id].taskData.playerKilled >= killedNum) {
				isCompleted(player, id);
			}
		}
	}
	if (!!reData) {
	  messageService.pushMessageToPlayer({uid:player.userId, sid : player.serverId}, 'onUpdateTaskData', reData);
	}
};

/**
 * PushMessage to client when the curTask is completed
 *
 * @param {Object} player
 * @param {Number} taskId
 * @api private
 */
//达到完成任务条件，推送消息给客户端，激活完成按钮
var isCompleted = function(player, taskId) {
		player.completeTask(taskId);
    messageService.pushMessageToPlayer({uid:player.userId, sid : player.serverId}, 'onTaskCompleted', {
		 taskId: taskId
	 });
};

