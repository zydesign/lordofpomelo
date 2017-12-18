var consts = require('../../consts/consts');
var messageService = require('./../messageService');
var logger = require('pomelo-logger').getLogger(__filename);

var exp = module.exports;

//玩家事件类
/**
 * Handle player event
 */
//给玩家角色添加事件监听
exp.addEventForPlayer = function (player){
	/**
	 * Handler upgrade event for player, the message will be pushed only to the one who upgrade
	 */
	//监听"升级"事件
	player.on('upgrade', function() {
		logger.debug('event.onUpgrade: ' + player.level + ' id: ' + player.id);
		var uid = {uid:player.userId, sid : player.serverId};
		//将升级的角色属性推送到该角色
		messageService.pushMessageToPlayer(uid, 'onUpgrade', player.strip());
	});

	/**
	 * Handle pick item event for player, it will invoked when player pick item success
	 */
	//监听"拾取"事件
	player.on('pickItem', function(args){
		//如果拾取的结果不是成功，直接返回
		if(args.result !== consts.Pick.SUCCESS){
			logger.debug('Pick Item error! Result : ' + args.result);
			return;
		}

		var item = args.item;
		var player = args.player;

		//如果拾取的结果是成功的，删除场景的目标道具，广播消失aoi附近的观察者，道具消失
		player.area.removeEntity(item.entityId);
		messageService.pushMessageByAOI(player.area, {route: 'onPickItem', player: player.entityId, item: item.entityId, index: args.index}, {x: item.x, y: item.y});
	});
};
