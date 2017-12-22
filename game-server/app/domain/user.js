/**
 *Module dependencies
 */

var util = require('util');

/**
 * Initialize a new 'User' with the given 'opts'.
 *
 * @param {Object} opts
 * @api public
 */

var User = function(opts) {
	this.id = opts.id;  	                      //数据库的user.id，也即uid		
	this.name = opts.name;                        //用户名
  this.from = opts.from || '';
	this.password = opts.password;		      //密码	
	this.loginCount = opts.loginCount;            //登录次数
	this.lastLoginTime = opts.lastLoginTime;      //上次登录时间
};

/**
 * Expose 'Entity' constructor
 */

module.exports = User;
