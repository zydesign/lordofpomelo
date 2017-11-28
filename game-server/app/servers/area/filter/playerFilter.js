var logger = require('pomelo-logger').getLogger(__filename);
var pomelo = require('pomelo');

module.exports = function() {
	return new Filter();
};

var Filter = function() {
};

/**
 * Area filter 只要客户端直接访问场景服务器都说明有角色在场景服务器中，因为player进入场景是通过connector.entryHandler.entryPlayer完成的
 */
Filter.prototype.before = function(msg, session, next){
	var area = pomelo.app.areaManager.getArea(session.get('instanceId'));
	session.area = area;
	var player = area.getPlayer(session.get('playerId'));

	if(!player){
		var route = msg.__route__;

		if(route.search(/^area\.resourceHandler/i) == 0 || route.search(/enterScene$/i) >= 0){
			//这里next传递（null，msg）
			next();
			return;
		}else{
			//而这里next传递（error，msg）
			next(new Error('No player exist!'));
			return;
		}
	}

	if(player.died){
		//同上
		next(new Error("You can't move a dead man!!!"));
		return;
	}

	next();
};
