/**
 * Module dependencies
 */

var dataApi = require('../../../util/dataApi');
var consts = require('../../../consts/consts');
var taskDao = require('../../../dao/taskDao');
var logger = require('pomelo-logger').getLogger(__filename);
var taskReward = require('../../../domain/taskReward');
var pomelo = require('pomelo');
var underscore = require('underscore');

/**
 * Expose 'Entity' constructor
 */

var handler = module.exports;

/**
 * Create and start task.
 * Handle the request from client, and response result to client
 *
 * @param {Object} msg
 * @param {Object} session
 * @param {Function} next
 * @api public
 */
//客户端发起，接取任务
handler.startTask = function(msg, session, next) {
	var playerId = msg.playerId, taskId = msg.taskId;   //这个taskId是任务表的种类id
	var player = session.area.getPlayer(playerId);      //从session中可以获取场景area，可以场景获取player实体
	var curTasks = player.curTasks;                     //获取玩家当前已经接取的任务
	//check out the curTasks, if curTasks exist, return.
	//遍历player的已接任务，如果已经接取过taskId种类的任务，直接返回
	//PS：通过这里检验，player.curTasks中已接任务必然是不同kindId的任务
	for (var _ in curTasks) {
		if (!!curTasks[taskId])    //因为是遍历的，可以用task的kindId作为key
		return;
	}
	//数据库插入新任务，并监听该任务的save事件，返回cb为task实例
	taskDao.createTask(playerId, taskId, function(err,task) {
		if (!!err) {
			logger.error('createTask failed');
		} else {
		player.startTask(task);  //玩家开始该任务，同步任务属性到数据库，并添加到curTasks已接任务组中
		var taskData = {
			acceptTalk: task.acceptTalk,
			workTalk: task.workTalk,
			finishTalk: task.finishTalk,
			item: task.item,
			name: task.name,
			id: task.id,
			type: task.type,
			exp: task.exp,
			taskData: task.taskData,
			taskState: task.taskState,
			completeCondition: task.completeCondition
		};
		next(null, {
			code: consts.MESSAGE.RES,
			taskData: taskData     //发给客户端接取的任务信息
		});
		}
	});
};


/**
 * Handover task and give reward to the player.
 * Handle the request from client, and response result to client
 *
 * @param {Object} msg
 * @param {Object} session
 * @param {Function} next
 * @api public
 */

//客户端发起，完成任务
handler.handoverTask = function(msg, session, next) {
	var playerId = msg.playerId;
	var player = session.area.getPlayer(playerId);
	var tasks = player.curTasks;
	var taskIds = [];   //已完成的task.id组
	//获取玩家已接任务中，状态为完成未发送的task.id，存入kaskIds数组
	for (var id in tasks) {
		var task = tasks[id];
		//任务状态为：完成但未发送
		if (task.taskState === consts.TaskState.COMPLETED_NOT_DELIVERY) {
			taskIds.push(id);
		}
	}
	//执行任务奖励的奖赏函数，奖励装备物品掉落场景中，奖励经验---------------------------------------【任务奖励发放】
	taskReward.reward(session.area, player, taskIds);
	//执行玩家完成任务函数
	player.handOverTask(taskIds);
	next(null, {
		code: consts.MESSAGE.RES,
		ids: taskIds             //发给客户端已经完成任务的kaskIds数组
	});
};

/**
 * Get history tasks of the player.
 * Handle the request from client, and response result to client
 *
 * @param {object} msg
 * @param {object} session
 * @param {function} next
 * @api public
 */
handler.getHistoryTasks = function(msg, session, next) {
	var playerId = msg.playerId;
	taskDao.getTaskByPlayId(playerId, function(err,tasks) {
		if (err) {
			logger.error('getHistoryTasks failed!');
			next(new Error('fail to get history tasks'));
		} else {
			var length = tasks.length;
			var reTasks = [];
			for (var i = 0; i < length; i++) {
				var task = tasks[i];
				reTasks.push({
					acceptTalk: task.acceptTalk,
					item: task.item,
					name: task.name,
					id: task.id,
					exp: task.exp,
					taskData: task.taskData,
					taskState: task.taskState
				});
			}
			next(null, {
				code: consts.MESSAGE.RES,
				route: 'onGetHistoryTasks',
				reTasks: reTasks
			});
		}
	});
};

/**
 * Get new Task for the player.
 *
 * @param {object} msg
 * @param {object} session
 * @param {function} next
 * @api public
 */

handler.getNewTask = function(msg, session, next) {
  var player = session.area.getPlayer(msg.playerId);
  var tasks = player.curTasks;
  if(!underscore.isEmpty(tasks)) {
    var keysList = underscore.keys(tasks);
    keysList = underscore.filter(keysList, function(tmpId) {
      var tmpTask = tasks[tmpId];
      if(tmpTask.taskState <= consts.TaskState.COMPLETED_NOT_DELIVERY) {
        return true;
      } else {
        return false;
      }
    });
    if(keysList.length > 0) {
      var maxId = underscore.max(keysList);
      var task = dataApi.task.findById(tasks[maxId].kindId);
      if(!task) {
        logger.error('getNewTask failed!');
        next(new Error('fail to getNewTask!'));
      } else {
        next(null, {
          code: consts.MESSAGE.RES,
          task: task
        });
      }
      return;
    }
  }

	var id = 0;
	taskDao.getTaskByPlayId(msg.playerId, function(err, tasks) {
		if (!!err) {
			logger.error('getNewTask failed!');
			next(new Error('fail to getNewTask!'));
		//do not start task
		} else {
			var length = tasks.length;
			if (length > 0) {
				for (var i = 0; i < length; i++) {
					if (parseInt(tasks[i].kindId) > id) {
						id = parseInt(tasks[i].kindId);
					}
				}
			}
			var task = dataApi.task.findById(++id);
			next(null, {
				code: consts.MESSAGE.RES,
				task: task
			});
		}
	});
};
