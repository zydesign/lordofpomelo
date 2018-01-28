__resources__["/objectPoolManager.js"] = {meta: {mimetype: "application/javascript"}, data: function(exports, require, module, __filename, __dirname) {

	/**
	 * Module dependencies
	 */
		
	//对象池管理。用于储存对象池
	var ObjectPoolManager = function() {
		this.pools = {};     //对象池 组
	};

	//Add pool named name to pools
	//添加对象池
	ObjectPoolManager.prototype.addPool = function(name, pool) {
		this.pools[name] = pool;
	};

	//get pool named name from pools
	//获取对象池
	ObjectPoolManager.prototype.getPool = function(name) {
		return this.pools[name];
	};
		
	module.exports = ObjectPoolManager;
}};
