__resources__["/objectPool.js"] = {meta: {mimetype: "application/javascript"}, data: function(exports, require, module, __filename, __dirname) {

	/**
	 * Initialize 'objectPool' with the given 'opts'
	 * ObjectPool maintains a number of objects with the same information
	 */
	//对象池
	var ObjectPool = function(opts) {
		this.getNewObject = opts.getNewObject;          //从参数中获取对象（动画实例）
		this.destoryObject = opts.destoryObject;        //部分破坏
		this.initCount = opts.initCount || 5;           //初始数量
		this.enlargeCount = opts.enlargeCount || 2;     //扩展数量
		this.index = 0;                                 //标签
		this.maxCount = 15;                             //最大数量
		this.pool = [];                                 //对象数组

		this._initialize();                             //立即执行初始化
	};

	/**
	 * Get item from objectPool.
	 *
	 * @return {Object}
	 * @api public
	 */

	ObjectPool.prototype.getObject = function() {
		if (this.index > 0) {
			return this.pool[--this.index];
		}
		if (this.pool.length > this.maxCount) {
			return null;
		}
		for(var i = 0; i < this.enlargeCount; i++) {
			this.pool.unshift(this.getNewObject());
		}
		this.index = this.enlargeCount;
		return this.getObject();
	};

	/**
	 * Return item to objectPool.
	 *
	 * @api public
	 */

	ObjectPool.prototype.returnObject = function(object) {

		if (this.index >= this.pool.length) {
			return;
		}
		this.pool[this.index++] = object;
	};

	/**
	 * Destory objectPool
	 *
	 * @api public
	 */

	ObjectPool.prototype.destory = function() {
		var n = this.pool.length;
		for (var i = 0; i < n; i++) {
			this.destoryObject(this.pool[i]);
		}
		this.pool = null;
		this.getNewObject = null;
		this.destoryObject = null;
	};

	/*
	 * Initialize the object pool with function getNewObject
	 *
	 * @api private
	 */

	ObjectPool.prototype._initialize = function() {
		if (!this.getNewObject) {
			return;
		}
		for (var i = 0; i < this.initCount; i++) {
			this.pool[i] = this.getNewObject();
		}
		this.index = this.initCount;
	};

	module.exports = ObjectPool;

}};
