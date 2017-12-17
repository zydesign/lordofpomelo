var _poolModule = require('generic-pool');
var mysql = require('mysql');

/*
 * Create mysql connection pool.
 */
//创建数据库连接池，注意作用是使用账号、密码创建数据库连接，以便增删改查数据.............................
var createMysqlPool = function(app){
	var mysqlConfig = app.get('mysql');  //从app对象中获取数据库配置（连接数据库的账号、密码）
	const factory = {
		create: function(){
			return new Promise(function(resolve, reject){
				//通过数据库模块mysql，创建一个连接到数据库
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
