//优先队列
var PriorityQueue = require('pomelo-collection').priorityQueue;
var id = 0;

/**
 * The cache for pathfinding
 * 寻路的缓存类。（队列的首位位是最先使用的，新加入的都是排到队列末位。排列方式按时间先后排列）
 */
var PathCache = function(opts) {
	this.id = id++;                                //路径缓存id
	this.limit = opts.limit||30000;                //数量限制
	this.size = 0;                                 //路径数量
	this.queue = new PriorityQueue(comparator);    //优先排序
	this.cache = {};                               //缓存组
};

var pro = PathCache.prototype;

/**
 * Get a path from cache
 * 从缓存中获取路径
 * @param x1, y1 {Number} Start point of path 起点
 * @param x2, y2 {Number} End point of path  终点
 * @return {Object} The path in cache or null if no path exist in cache.
 * @api public
 */
//获取两坐标间的路径
pro.getPath = function(x1, y1, x2, y2) {
	//路径的key
	var key = this.genKey(x1, y1, x2, y2);
	
	if(!!this.cache[key]) {
		return this.cache[key];
	}
		
	return null;
};

/**
 * Generate key for given path, for a path can be identified by start and end point, we use then to construct the key
 * @param x1, y1 {Number} Start point of path
 * @param x2, y2 {Number} End point of path
 * @return {String} The path's key
 * @api public
 */
//生成key
pro.genKey = function(x1, y1, x2, y2) {
	return x1 + '_' + y1 + '_' + x2 + '_' + y2;    //x1_y1_x2_y2
};

/**
 * Add a path to cache
 * 储存一个路径到缓存
 * @param x1, y1 {Number} Start point of path
 * @param x2, y2 {Number} End point of path
 * @param path {Object} The path to add
 * @api public
 */
//添加路径到缓存组(参数：起点(x1,y1)，终点(x2,y2),对应路径path)-------------------------------------------------增
pro.addPath = function(x1, y1, x2, y2, path) {
	var key = this.genKey(x1, y1, x2, y2);
	
	//如果缓存组有该路径，更新该缓存路径，加入update和time属性。但是还没有应用到排序中
	if(!!this.cache[key]) {
		//缓存更新路径-------------------------------------------------------------------------加入的路径
		this.cache[key] = path;
		this.cache[key].update = true;
		this.cache[key].time = Date.now();
		
	//如果缓存组没有该路径，并且路径数量没到最大值，将路径加入队列首位（第一次加入是没有update属性的）	
	} else if(this.size < this.limit) {
		//执行队列的加入函数。把key对象按照时间先后顺序存入queue的队列数组中，后加入的都放前面
		this.queue.offer({
			time : Date.now(),
			key : key
		});
		//缓存加入新路径------------------------------------------------------------------------加入的路径
		this.cache[key] = path;
		this.size++;
	//如果缓存组没有该路径，并且路径总量已经到极限值
	} else if(this.size === this.limit) {		
		//先将队列首位（最早加入的）从队列中取出。（queue.pop()函数用于删除并返回队列的首位元素）
		var delKey = this.queue.pop().key;
		//如果首位对象在缓存组中已经更新过，刷新时间放到末位，再获取新排列的首位
		while(this.cache[delKey].update === true) {
			this.queue.offer({
				 //因为有update，所谓这个time必然是Date.now()；排序就到末位
				time : this.cache[delKey].time,   
				key : delKey
			});
			
			//再提取调整过的首位
			delKey = this.queue.pop().key;             //这里我加了key------------------------------bug
		}
		
		//一直检测到有一个没有更新过的，就从缓存中删除该路径
		delete this.cache[delKey];
		
		//再把新加入对象放到末位
		this.queue.offer({
			time : Date.now(),
			key : key
		});
		//缓存加入新路径-------------------------------------------------------------------加入的路径
		this.cache[key] = path;
	}
};

//排序方式。a为先加入，b为后加入。先加入的在前，后加入的在后，按时间先后排
var comparator = function(a, b) {
	return a.time < b.time;   
};

module.exports = PathCache;
