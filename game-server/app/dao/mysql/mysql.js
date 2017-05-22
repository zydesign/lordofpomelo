// mysql CRUD
//数据库连接模块将会被放到app上下文中，方便app.get（）
var sqlclient = module.exports;

var _pool;

var NND = {};

/*
 * Init sql connection pool
 *上面声明了对象池变量，在初始化里面给变量赋值
 * @param {Object} app The app for the server.
 */
NND.init = function(app){
	_pool = require('./dao-pool').createMysqlPool(app);
};

/**
 * Excute sql statement
 * 执行sql语句，返回的结构是执行sql语句的数据库返回值
 * @param {String} sql Statement The sql need to excute.
 * @param {Object} args The args for the sql.
 * @param {fuction} cb Callback function.
 * 
 */
NND.query = function(sql, args, callback){
	const resourcePromise = _pool.acquire();
	resourcePromise.then(function(client) {
		client.query(sql, args, function(err, res) {
			_pool.release(client);
			callback.apply(null, [err, res]);
		});
	}).catch(function(err){
		if(!!err){
			console.error('query error:',err);
		}
		callback(err);
	});
};

/**
 * Close connection pool.
 */
NND.shutdown = function(){
	_pool.drain().then(function(){
		_pool.clear();
	});
};

/**
 * init database
 *模块调用上面的函数，执行sql语句到数据库
 */
sqlclient.init = function(app) {
	if (!!_pool){
		return sqlclient;
	} else {
		NND.init(app);
		sqlclient.insert = NND.query;
		sqlclient.update = NND.query;
		sqlclient.delete = NND.query;
		sqlclient.query = NND.query;
		return sqlclient;
	}
};

/**
 * shutdown database
 * 模块关闭数据库
 */
sqlclient.shutdown = function(app) {
	NND.shutdown(app);
};






