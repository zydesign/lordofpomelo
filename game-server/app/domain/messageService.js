var pomelo = require('pomelo');
var logger = require('pomelo-logger').getLogger(__filename);
var EntityType = require('../consts/consts').EntityType;

//消息推送服务
var exp = module.exports;

//用户数组推送消息，如：团队推送uids 
exp.pushMessageByUids = function (uids, route, msg) {
	pomelo.app.get('channelService').pushMessageByUids(route, msg, uids, errHandler);
};
//单用户推送消息,参数uid：{uid:e.userId,sid:e.serverId}
exp.pushMessageToPlayer = function (uid, route, msg) {
  exp.pushMessageByUids([uid], route, msg);
};

//获取aoi灯塔用户数组，然后用户组推送消息（ignoreList是排除组，排除自己uid）
exp.pushMessageByAOI = function (area, msg, pos, ignoreList) {
	//获取指定灯塔点的玩家观察者uids 
  var uids = area.timer.getWatcherUids(pos, [EntityType.PLAYER], ignoreList);

	//然后用户组推送
  if (uids.length > 0) {
    exp.pushMessageByUids(uids, msg.route, msg);
  }
};

function errHandler(err, fails){
	if(!!err){
		logger.error('Push Message error! %j', err.stack);
	}
}
