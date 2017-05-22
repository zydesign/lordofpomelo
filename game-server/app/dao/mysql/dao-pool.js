var _poolModule = require('generic-pool');
var mysql = require('mysql');

/*
 * Create mysql connection pool.
 */
var createMysqlPool = function(app){
	//从app对象中获取数据库配置
	var mysqlConfig = app.get('mysql');
	const factory = {
		create: function(){
			return new Promise(function(resolve, reject){
				//通过数据库模块创建一个连接到数据库
				var client = mysql.createConnection({
					host: mysqlConfig.host,
					user: mysqlConfig.user,
					password: mysqlConfig.password,
					database: mysqlConfig.database
				});
				resolve(client);
			});
		},
		destroy: function(client){
			return new Promise(function(resolve){
				client.on('end', function(){
					resolve()
				});
				client.disconnect()
			});
		}
	}
	//把连接数据库这个对象，放入对象池中，提供持久化数据库连接服务
  	return _poolModule.createPool(factory, {max:10, min:2});
};

exports.createMysqlPool = createMysqlPool;
