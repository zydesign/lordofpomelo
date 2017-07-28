var Code = require('../../../../../shared/code');
var userDao = require('../../../dao/userDao');
var async = require('async');
var channelUtil = require('../../../util/channelUtil');
var utils = require('../../../util/utils');
var logger = require('pomelo-logger').getLogger(__filename);

module.exports = function(app) {
	return new Handler(app);
};

var Handler = function(app) {
	this.app = app;

	if(!this.app)
		logger.error(app);
};

var pro = Handler.prototype;

/**
 * New client entry game server. Check token and bind user info into session.
 * 新客户端进入游戏服务器。检查token并将用户信息绑定到session。
 * @param  {Object}   msg     request message
 * @param  {Object}   session current session object
 * @param  {Function} next    next stemp callback
 * @return {Void}
 */
pro.entry = function(msg, session, next) {
    console.log('entry: ',msg);
	var token = msg.token, self = this;

	if(!token) {
		next(new Error('invalid entry request: empty token'), {code: Code.FAIL});
		return;
	}

	//先声明要获取的变量
	var uid, players, player;
	async.waterfall([
		function(cb) {
			// auth token   解析token后，并获取code、user信息
			self.app.rpc.auth.authRemote.auth(session, token, cb);
		},
        function(code, user, cb) {
			// query player info by user id
		        // 通过uid查询角色信息
			if(code !== Code.OK) {
				next(null, {code: code});
				return;
			}

			if(!user) {
				next(null, {code: Code.ENTRY.FA_USER_NOT_EXIST});
				return;
			}

			uid = user.id;
			userDao.getPlayersByUid(user.id, cb);
		},
        function(res, cb) {
			// generate session and register chat status
		        //登录就要先踢掉之前的session链接，并从新生成session和注册聊天状态
			players = res;
			self.app.get('sessionService').kick(uid, cb);
		},
        function(cb) {
			session.bind(uid, cb);
		},
        function(cb) {
			if(!players || players.length === 0) {
				next(null, {code: Code.OK});
				return;
			}

			player = players[0];

		        // 将客户端发来的areaId，存入session，方便后面的每次访问路由到这个areaId的服务器
			session.set('serverId', self.app.get('areaIdMap')[player.areaId]);
			session.set('playername', player.name);
			session.set('playerId', player.id);
			session.on('closed', onUserLeave.bind(null, self.app));
			session.pushAll(cb);
		},
        function(cb) {
		        //加入聊天服务器
			self.app.rpc.chat.chatRemote.add(session, player.userId, player.name, channelUtil.getGlobalChannelName(), cb);
		}
	], function(err) {
		if(err) {
			next(err, {code: Code.FAIL});
			return;
		}
		console.log('entry success!!!!');

		//返回单条player信息给客户端
		next(null, {code: Code.OK, player: players ? players[0] : null});
	});
};

//玩家掉线，退出游戏功能
var onUserLeave = function (app, session, reason) {
    console.log('onUserLeave-reason: ', reason);
	if(!session || !session.uid) {
		return;
	}

	utils.myPrint('1 ~ OnUserLeave is running ...');
	//让玩家退出场景服务器 ，（instanceId是个无用的属性，多余的）
	app.rpc.area.playerRemote.playerLeave(session, {playerId: session.get('playerId'), instanceId: session.get('instanceId')}, function(err){
		if(!!err){
			logger.error('user leave error! %j', err);
		}
	});
	//让玩家退出聊天服务器
	app.rpc.chat.chatRemote.kick(session, session.uid, null);
};
