var tokenService = require('../../../../../shared/token');
var userDao = require('../../../dao/userDao');
var Code = require('../../../../../shared/code');

var DEFAULT_SECRET = 'pomelo_session_secret';
var DEFAULT_EXPIRE = 6 * 60 * 60 * 1000;	// default session expire time: 6 hours

module.exports = function(app) {
	return new Remote(app);
};

var Remote = function(app) {
	this.app = app;
	var session = app.get('session') || {};
	this.secret = session.secret || DEFAULT_SECRET;
	this.expire = session.expire || DEFAULT_EXPIRE;
};

var pro = Remote.prototype;

/**
 * Auth token and check whether expire.
 * 验证token，并检查是否过期。
 * @param  {String}   token token string
 * @param  {Function} cb
 * @return {Void}
 */
pro.auth = function(token, cb) {
	// 解析token来验证它，并获得uid和时间戳。
	var res = tokenService.parse(token, this.secret);
	if(!res) {
		cb(null, Code.ENTRY.FA_TOKEN_ILLEGAL);
		return;
	}

	if(!checkExpire(res, this.expire)) {
		cb(null, Code.ENTRY.FA_TOKEN_EXPIRE);
		return;
	}

	//通过解析token得到的uid获取user
	userDao.getUserById(res.uid, function(err, user) {
		if(err) {
			cb(err);
			return;
		}

		cb(null, Code.OK, user);
	});
};

/**
 * Check the token whether expire.
 *检查token是否过期
 * @param  {Object} token  token info
 * @param  {Number} expire expire time
 * @return {Boolean}        true for not expire and false for expire
 */
var checkExpire = function(token, expire) {
	if(expire < 0) {
		// negative expire means never expire
		// 负到期意味着永远不到期
		return true;
	}

	return (Date.now() - token.timestamp) < expire;
};
