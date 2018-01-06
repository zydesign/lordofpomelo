var buildFinder = require('pomelo-pathfinding').buildFinder;
var geometry = require('../../util/geometry');
var PathCache = require('../../util/pathCache');
var utils = require('../../util/utils');
var logger = require('pomelo-logger').getLogger(__filename);
var formula = require('../../consts/formula');
var fs = require('fs');

/**
 * The data structure for map in the area
 * 游戏地图类。
 */

//opts参数为场景数据表子场景数据。（map类将会被场景脚本scene.js调用，生成场景area的同时，生成地图map））
var Map = function(opts) {
	//area.json场景配置的子对象的path属性为tiledMap地图数据脚本路径
	this.mapPath = process.cwd() + opts.path;
	//this.map为地图数据对象
	this.map = null;    //这个属性由this.configMap(map)赋值，
	//默认权重图阵为空（权重值：1为可走，Infinity为不可走）
	this.weightMap = null;
	this.name = opts.name;

	//给工厂函数添加更多属性
	this.init(opts);
};

var pro = Map.prototype;

/**
 * Init game map
 * 游戏地图初始化，opts参数场景表单获取的场景数据
 * @param {Object} opts
 * @api private
 */
Map.prototype.init = function(opts) {
	var weightMap = opts.weightMap || false;
	//地图配置文件（/config/map/xxx.json），获取tiledMap地图数据
	var map = require(this.mapPath);
	if(!map) {
		logger.error('Load map failed! ');
	} else {
		//通过tiledMap地图数据，给this.map赋值，
		//this.map为：{birth:[{},{}...],mob:[{},{}...],collision:[{},{}...]}
		this.configMap(map);
		
		this.id = opts.id;                                 //场景area的id
		this.width = opts.width;                           //地图宽度
		this.height = opts.height;                         //地图高度
		this.tileW = 20;                                   //瓦片宽
		this.tileH = 20;                                   //瓦片高
		
		//Math.ceil()舍入小数，返回值大于自身
		this.rectW = Math.ceil(this.width/this.tileW);     //瓦片宽数量
		this.rectH = Math.ceil(this.height/this.tileH);    //瓦片高数量

		this.pathCache = new PathCache({limit:1000});      //路径缓存
		this.pfinder = buildFinder(this);                  //寻路模块

		if(weightMap) {
			//Use cache map first
			//优先使用缓存地图
			//其中'/tmp/map.json'的配置文件的数据是通过fs.writeFileSync（）生成的，用到新项目先清空数据
			var path = process.cwd() + '/tmp/map.json';
			//障碍物数据。先判断这个配置文件是否存在，不存在就赋值为空对象
			var maps = fs.existsSync(path)?require(path) : {};

			//如果指定场景id的【障碍物数据】存在
			if(!!maps[this.id]){
				this.collisions = maps[this.id].collisions;             //障碍物
				this.weightMap = this.getWeightMap(this.collisions);    //生成权重图阵
			}else{
			//如果指定场景id没有【障碍物数据】
				this.initWeightMap();           //执行初始化权重图阵，生成this.weightMap数组
				this.initCollisons();           //执行初始化障碍物，生成this.collisions数组
				maps[this.id] = {version : Date.now(), collisions : this.collisions}; //生成指定id场景的【障碍物数据】
				fs.writeFileSync(path, JSON.stringify(maps));        //将指定场景id的障碍物写入障碍物脚本    
			}

		}
	}
};

//读取tiledMap地图数据，给this.map赋值，属性为图层layers
//地图配置文件由tiledmap生成，tiled用法，只使用对象层。对象层用于地图背景、玩家、出生地、怪物、道具、障碍物
//tiledmap的障碍物对象层命名必须为collision，这样this.map[layer.name]就得到this.map.collision为obj数组
//tiledmap坐标原点在左上角，y轴朝下；画出的矩形、多边形原点也是左上角（多边形要从左上角开始画）
//tiledmap对象层约定命名规则：出生地（birth）、障碍物（collision）、npc（npc）、怪物（mob）
//障碍物可以用多边形和矩形来画，不能用圆形。而出生地、npc、怪物、道具都必须是用矩形画

//只获取tiledMap地图数据的对象层，生成不同类型的对象数组：{birth:[{},{}...],mob:[{},{}...],collision:[{},{}...]}
Map.prototype.configMap = function(map){
	this.map = {};          //地图对象数据
	var layers = map.layers; //获取图层属性layers
	//遍历所有图层，只获取对象层的数据作为this.map的属性值，key为对象成的name
	for(var i = 0; i < layers.length; i++){
		var layer = layers[i];
		if(layer.type === 'objectgroup'){
			//图层的属性类型为对象层时，读取对象层，并配置对象层objects属性的每一个object的属性
			//this.map[layer.name]的值为修改过的objects数组
			this.map[layer.name] = configObjectGroup(layer.objects);
		}
	}
};

//遍历对象层的单个obj对象的properties的自定义属性提取作为obj的属性，并删除properties项
function configProps(obj){
	if(!!obj && !!obj.properties){
		for(var key in obj.properties){
			obj[key] = obj.properties[key];
		}

		//删除properties属性
		delete obj.properties;
	}

	return obj;
}

//遍历对象层的objects数组，从新配置每一个对象
function configObjectGroup(objs){
	for(var i = 0; i < objs.length; i++){
		//每一个对象properties属性获取属性作为对象属性
		objs[i] = configProps(objs[i]);
	}

	return objs;
}

/**
 * Init weight map, which is used to record the collisions info, used for pathfinding
 * 初始化权重映射，用来记录障碍物信息，用于寻路，1为可走，Infinity为不可走
 * 通过地图配置的Collision对象层的objs数组，算出每一个瓦片坐标的权重映射值
 * @api private
 */
//初始化权重图阵。通过this.map中的障碍物数组，算出每一个瓦片的权重值--------------------------------------------------------
Map.prototype.initWeightMap = function() {
	var collisions = this.getCollision();       //障碍物对象数组  
	var i, j, x, y, x1, y1, x2, y2, p, l, p1, p2, p3, p4;
	this.weightMap =  [];
	//遍历每一块瓦片，创建权重图阵数组，初始值设置为1
	for(i = 0; i < this.rectW; i++) {
		this.weightMap[i] = [];
		for(j = 0; j < this.rectH; j++) {
			this.weightMap[i][j] = 1;
		}
	}

	//Use all collsions to construct the weight map
	//使用所有的障碍物构成权重映射
	for(i = 0; i < collisions.length; i++) {
		var collision = collisions[i];
		var polygon = [];
		
		//单个障碍物的多边形变形[坐标点数组]（tiledMap生成的多边形点是相对坐标）
		//画多边形第一个点所在的地图位置是多边形坐标
		var points = collision.polygon;   

		//如果障碍物是用多边形polygon画的...............................................................
		if(!!points && points.length > 0) {
			if(points.length < 3) {
				logger.warn('The polygon data is invalid! points: %j', points);
				continue;
			}

			//Get the rect limit for polygonal collision
			//通过多边形障碍物获取矩形极限
			var minx = Infinity, miny = Infinity, maxx = 0, maxy = 0;

			//遍历多边形polygon的点
			for(j = 0; j < points.length; j++) {
				var point = points[j];

				//转换多边形的点坐标为tiledMap地图的实际坐标
				x = Number(point.x) + Number(collision.x);
				y = Number(point.y) + Number(collision.y);
				
				//计算多边形所在的矩形左上、右下两实际坐标点（minx，miny) ,(maxx，maxy)
				minx = minx>x?x:minx;           
				miny = miny>y?y:miny;           
				maxx = maxx<x?x:maxx;           
				maxy = maxy<y?y:maxy;           
				polygon.push({x: x, y: y});
			}

			//A polygon need at least 3 points
			if(polygon.length < 3) {
				logger.error('illigle polygon: points : %j, polygon: %j', points, polygon);
				continue;
			}

			//多边形所在矩形左上、右下瓦片点
			//floor为小数去掉，返回最小整数；ceil为小数舍入，返回最大整数
			x1 = Math.floor(minx/this.tileW);
			y1 = Math.floor(miny/this.tileH);
			x2 = Math.ceil(maxx/this.tileW);
			y2 = Math.ceil(maxy/this.tileH);

			//regular the poinit to not exceed the map
			//限制瓦片点不超过地图
			x1 = x1<0?0:x1;
			y1 = y1<0?0:y1;
			x2 = x2>this.rectW?this.rectW:x2;
			y2 = y2>this.rectH?this.rectH:y2;

			//For all the tile in the polygon's externally rect, check if the tile is in the collision
			//遍历多边形外部的矩形框内的所有瓦片点，检测瓦片是否包含了障碍物
			for(x = x1; x < x2; x++) {
				for(y = y1; y < y2; y++) {
					//瓦片所在的像素点，为该瓦片的中心点
					p = {x: x*this.tileW + this.tileW/2, y : y*this.tileH + this.tileH/2};
					l = this.tileW/4;
					//每一个瓦片内取4个像素点
					p1 = { x: p.x - l, y: p.y - l};
					p2 = { x: p.x + l, y: p.y - l};
					p3 = { x: p.x - l, y: p.y + l};
					p4 = { x: p.x + l, y: p.y + l};
					//瓦片内取的4个像素点，如果有一个在多边形内，则该瓦片的权重值为Infinity（不可走）
					if(geometry.isInPolygon(p1, polygon) ||
						 geometry.isInPolygon(p2, polygon) ||
						 geometry.isInPolygon(p3, polygon) ||
						 geometry.isInPolygon(p4, polygon)) {
						this.weightMap[x][y] = Infinity;
					}
				}
			}
		} else {
		//如果障碍物是用矩形画的时候，获取左上、右下两个瓦片点......................................................
			x1 = Math.floor(collision.x/this.tileW);
			y1 = Math.floor(collision.y/this.tileH);

			x2 = Math.ceil((collision.x+collision.width)/this.tileW);
			y2 = Math.ceil((collision.y+collision.height)/this.tileH);

			//regular the poinit to not exceed the map
			//保证瓦片点不超过地图边界
			x1 = x1<0?0:x1;
			y1 = y1<0?0:y1;
			x2 = x2>this.rectW?this.rectW:x2;
			y2 = y2>this.rectH?this.rectH:y2;

			//遍历矩形内的所有瓦片点，给这些瓦片权重值都设置为Infinity（不可走）
			for(x = x1; x < x2; x++) {
				for(y = y1; y < y2; y++) {
					this.weightMap[x][y] = Infinity;
				}
			}
		}
	}
};

//初始化地图障碍物，通过权重图阵this.weightMap生成this.collisions数组------------------------------------------------------
//this.collisions形式：[{collisions: [{"start":26,"length":3},{"start":79,"length":3}...]},{collisions: []},{collisions: []}...]
Map.prototype.initCollisons = function(){
	var map = [];
	var flag = false;//（是否标记了障碍物）
	var collision;

	for(var x = 0; x < this.weightMap.length; x++){
		var array = this.weightMap[x];
		var length = array.length;
		//每x列的障碍物数组
		var collisions = [];  //形式：[{"start":y,"length":3},{"start":y,"length":1}...]
		for(var y = 0; y < length; y++){
		//conllisions start
		//start，如果flag为fasle（未标记障碍物）而且瓦片点位置为不可走，设置障碍物的第x列的起点该瓦片点的y，flag标记为true
			if(!flag && (array[y] === Infinity)){
				collision = {}; //第x列，第y块瓦片设置一个障碍物对象
				collision.start = y;
				flag = true;
			}

		//end，如果flag标记为true，第x列第y位置为1（可走）时，标记停止，该x列的障碍物加入数组
			if(flag && array[y] === 1){
				flag = false;
				collision.length = y - collision.start;  //x列障碍物起点到终点的长度length
				collisions.push(collision);
		//end，如果flag标记为true，而且第x列遍历到了尽头，标记停止，该x列的障碍物加入数组
			}else if(flag && (y === length - 1)){
				flag = false;
				collision.length = y - collision.start + 1;
				collisions.push(collision);
			}
		}

		//将每x列的障碍物作为对象存入map数组
		map[x] = {collisions: collisions};
	}

	//保存 障碍物图阵 到this.collisions
	this.collisions = map;
};

//通过this.collisions作为参数，获取权重图阵
Map.prototype.getWeightMap = function(collisions){
	var map = [];
	var x, y;
	for(x = 0; x < this.rectW; x++) {
		var row = [];
		for(y = 0; y < this.rectH; y++) {
			row.push(1);
		}
		map.push(row);
	}

	for(x = 0; x < collisions.length; x++){
		var array = collisions[x].collisions;
		if(!array){
			continue;
		}
		for(var j = 0; j < array.length; j++){
			var c = array[j];
			for(var k = 0; k < c.length; k++){
				map[x][c.start+k] = Infinity;
			}
		}
	}
	return map;
};

/**
 * Get all mob zones in the map
 * 获取地图怪物对象数组
 * @return {Array} All mobzones in the map
 * @api public
 */
//获取地图怪物对象，用于生成怪物空间MobZones。（area场景运行时作为area.initMobZones（opt）的参数调用）............................0
Map.prototype.getMobZones = function() {
	if(!this.map) {
		logger.error('map not load');
		return null;
	}
	return this.map.mob;
};

/**
 * Get all npcs from map
 * @return {Array} All npcs in the map
 * @api public
 */
//获取地图npc对象数组。地图NPC设置时要自定义属性加入npc表单的id（area.initNPCs调用该函数，用到id）
Map.prototype.getNPCs = function() {
	return this.map.npc;
};

/**
 * Get all collisions form the map
 * @return {Array} All collisions
 * @api public
 */
//获取地图障碍物数组
Map.prototype.getCollision = function() {
	return this.map.collision;
};

/**
 * Get born place for this map
 * @return {Object} Born place for this map
 * @api public
 */
// temporary code
//获取地图出生地对象数组，返回出生地第一个对象（由出生点Map.getBornPoint调用）
Map.prototype.getBornPlace = function() {
	var bornPlace = this.map.birth[0];
	if(!bornPlace) {
		bornPlace = this.map.transPoint;
	}

	if(!bornPlace) {
		return null;
  }

	return bornPlace;
};
/*
Map.prototype.getBornPlace = function() {
  var bornPlaces = this.getMobZones();
  var randomV = Math.floor(Math.random() * bornPlaces.length);
	var bornPlace = bornPlaces[randomV];

	if(!bornPlace) {
		return null;
  }

	return bornPlace;
};
*/
// temporary code

/**
 * Get born point for this map, the point is random generate in born place
 * @return {Object} A random generated born point for this map.
 * @api public
 */

//从出生地内部随机生成出生点（像素坐标）（角色进入地图，或复活时调用）
Map.prototype.getBornPoint = function() {
	var bornPlace = this.getBornPlace();

	var pos = {
		x : bornPlace.x + Math.floor(Math.random()*bornPlace.width),
		y : bornPlace.y + Math.floor(Math.random()*bornPlace.height)
	};

	return pos;
};

/**
 * Random generate a position for give pos and range
 * 
 * @param pos {Object} The center position
 * @param range {Number} The max distance form the pos
 * @return {Object} A random generate postion in the range of given pos
 * @api public
 */
//指定坐标及范围，随机生成一个怪物出生点（像素坐标）
Map.prototype.genPos = function(pos, range) {
	var result = {};
	var limit = 10;

	//10次生成机会，在指定的空间内返回生成一个可走的坐标
	for(var i = 0; i < limit; i++) {
		var x = pos.x + Math.random()*range - range/2;
		var y = pos.y + Math.random()*range - range/2;

		if(this.isReachable(x, y)) {
			result.x = x;
			result.y = y;
			return result;
		}
	}

	return null;
};

/**
 * Get all reachable pos for given x and y
 * This interface is used for pathfinding
 * @param x {Number} x position.
 * @param y {Number} y position.
 * @param processReachable {function} Call back function, for all reachable x and y, the function will bu called and use the position as param
 * @api public
 */
//获取所有地图内可走的瓦片点，用于寻路函数
Map.prototype.forAllReachable = function(x, y, processReachable) {
	//瓦片点对应的斜上方点、斜下方点
	var x1 = x - 1, x2 = x + 1;
	var y1 = y - 1, y2 = y + 1;

	//确保获取的两点在tiled地图里面
	x1 = x1<0?0:x1;
	y1 = y1<0?0:y1;
	x2 = x2>=this.rectW?(this.rectW-1):x2;
	y2 = y2>=this.rectH?(this.rectH-1):y2;

	if(y > 0) {
		processReachable(x, y - 1, this.weightMap[x][y - 1]);
	}
	if((y + 1) < this.rectH) {
		processReachable(x, y + 1, this.weightMap[x][y + 1]);
	}
	if(x > 0) {
		processReachable(x - 1, y, this.weightMap[x - 1][y]);
	}
	if((x + 1) < this.rectW) {
		processReachable(x + 1, y, this.weightMap[x + 1][y]);
	}
};

/**
 * Get weicht for given pos
 */
//获取瓦片点的权重值
Map.prototype.getWeight = function(x, y) {
	return this.weightMap[x][y];
};

/**
 * Return is reachable for given pos
 * 通过权重值判断可走不可走，1为可走
 */
//通过坐标所在的瓦片点发权重值，判断可走不可走。1为可走，Infinity为不可走。可走返回true，不可走返回false
Map.prototype.isReachable = function(x, y) {
	//如果坐标不在地图里，返回false
	if(x < 0 || y < 0 || x >= this.width || y >= this.height) {
		return false;
	}

	try{
		//转换坐标为瓦片点
	var x1 = Math.floor(x/this.tileW);
	var y1 = Math.floor(y/this.tileH);

		//如果瓦片点不在权重图阵中，返回false
	if(!this.weightMap[x1] || !this.weightMap[x1][y1]) {
		return false;
  }
}catch(e){
	console.error('reachable error : %j', e);
}

	//最终结果，返回：坐标对应的瓦片点权重值是否为1
	return this.weightMap[x1][y1] === 1;
};

/**
 * Find path for given pos
 * 通过坐标获取路径，返回坐标集，及寻路费用
 * @param x, y {Number} Start point
 * @param x1, y1 {Number} End point
 * @param useCache {Boolean} If pathfinding cache is used
 * @api public
 */
//返回寻路路径。map.findPath(entity.x, entity.y, targetX, targetY, useCache)，参数为：实体自身坐标、目标坐标
//(ai系统、巡逻系统、点击移动等操作，执行character.move时，调用该函数)------------------------------------------------------寻路函数
Map.prototype.findPath = function(x, y, x1, y1, useCache) {
	useCache = useCache || false;
	//如果自身坐标，目标坐标不在地图内，返回null
	if( x < 0 || x > this.width || y < 0 || y > this.height || x1 < 0 || x1 > this.width || y1 < 0 || y1 > this.height) {
		logger.warn('The point exceed the map range!');
		return null;
	}

	//如果自身坐标为不可走，返回null
	if(!this.isReachable(x, y)) {
		logger.warn('The start point is not reachable! start :(%j, %j)', x, y);
		return null;
	}

	//如果目标坐标为不可走，返回null
	if(!this.isReachable(x1, y1)) {
		logger.warn('The end point is not reachable! end : (%j, %j)', x1, y1);
		return null;
	}

	//如果自身坐标和目标坐标之间没有障碍物就是【直线路径】，返回路径为自身坐标和目标坐标
  if(this._checkLinePath(x, y, x1, y1)) {
    return {path: [{x: x, y: y}, {x: x1, y: y1}], cost: formula.distance(x, y, x1, y1)};
  }

	//转换自身坐标、目标坐标为对应的瓦片点
	var tx1 = Math.floor(x/this.tileW);
	var ty1 = Math.floor(y/this.tileH);
	var tx2 = Math.floor(x1/this.tileW);
	var ty2 = Math.floor(y1/this.tileH);

	//Use cache to get path
	//通过瓦片点参数，从寻路缓存中获取瓦片点路径
	var path = this.pathCache.getPath(tx1, ty1, tx2, ty2);

	//如果缓存获取不到寻路路径，通过瓦片点，从新生成瓦片点路径
	if(!path || !path.paths) {
		path = this.pfinder(tx1, ty1, tx2, ty2);
		if(!path || !path.paths) {
			logger.warn('can not find the path, path: %j', path);
			return null;
		}

		//如果允许使用缓存，则将生成的新路径存入缓存，方便调用
		//储存参数tx1, ty1, tx2, ty2是瓦片点，path是坐标数组
		if(useCache) {
			this.pathCache.addPath(tx1, ty1, tx2, ty2, path);
		}
	}

	var result = {};
	var paths = [];

	//将【瓦片点路径】转换成【坐标路径】--------------------------------------------------
	for(var i = 0; i < path.paths.length; i++) {
		paths.push(transPos(path.paths[i], this.tileW, this.tileH));
	}
	//如果存在共线的3坐标，则合并掉多余的坐标
	paths = this.compressPath2(paths);
	if(paths.length > 2) {
		//相隔合拼
		paths = this.compressPath1(paths, 3);
		//共线合并
		paths = this.compressPath2(paths);
	}

	result.path = paths;                //像素坐标路径
	result.cost = computeCost(paths);   //使用的坐标路径计算的总距离，是像素距离

	//最后得到坐标路径和费用：{path: [{x, y}, {x, y},{x, y}...], cost: cost}
	return result;
};

/**
 * Compute cost for given path
 * 
 * @api public
 */
//计算路径费用（移动到路径上所有坐标的总距离）
function computeCost(path) {
	var cost = 0;
	for(var i = 1; i < path.length; i++) {
		var start = path[i-1];
		var end = path[i];
		cost += formula.distance(start.x, start.y, end.x, end.y);
	}

	return cost;
}

/**
 * compress path by gradient
 * @param tilePath {Array} Old path, construct by points
 * @param x {Number} start x
 * @param y {Number}	start y
 * @param x1 {Number}	end x
 * @param y1 {Number}	end y
 * @api private
 */
//如果路径有3点共线坐标，合并掉多余坐标
Map.prototype.compressPath2= function(tilePath) {
		var oldPos = tilePath[0];
		var path = [oldPos];

		for(var i = 1; i < (tilePath.length - 1); i++) {
			var pos = tilePath[i];
			var nextPos = tilePath[i + 1];

			//如果3点不共线
			if(!isLine(oldPos, pos, nextPos)) {
				path.push(pos);
			}

			oldPos = pos;
			pos = nextPos;
		}

		path.push(tilePath[tilePath.length - 1]);
		return path;
};

/**
 * Compress path to remove unneeded point
 * @param path [Ayyay] The origin path
 * @param loopTime [Number] The times to remove point, the bigger the number, the better the result, it should not exceed log(2, path.length)
 * @return The compressed path
 * @api private
 */
Map.prototype.compressPath1 = function(path, loopTime) {
	var newPath;

	for(var k = 0; k < loopTime; k++) {
		var start;
		var end;
		newPath = [path[0]];

		for(var i = 0, j = 2; j < path.length;) {
			start = path[i];
			end = path[j];
			//如果相隔一个坐标为直线路径，那么忽略中间坐标
			if(this._checkLinePath(start.x, start.y, end.x, end.y)) {
				newPath.push(end);
				i = j;
				j += 2;
			} else {
				//如果相隔一个坐标之间有障碍物，则不能忽略中间坐标
				newPath.push(path[i+1]);
				i++;
				j++;
			}

			if(j >= path.length) {
				if((i + 2) === path.length) {
					newPath.push(path[i+1]);
				}
			}
		}
		path = newPath;
	}

	return newPath;
};

/**
 * Veriry if the given path is valid
 * @param path {Array} The given path
 * @return {Boolean} verify result
 * @api public
 */
Map.prototype.verifyPath = function(path) {
	if(path.length < 2) {
		return false;
	}

	var i;
	for(i = 0; i < path.length; i++) {
		if(!this.isReachable(path[i].x, path[i].y)) {
			return false;
		}
	}

	for(i = 1; i < path.length; i++) {
		if(!this._checkLinePath(path[i-1].x, path[i-1].y, path[i].x, path[i].y)) {
			logger.error('illigle path ! i : %j, path[i] : %j, path[i+1] : %j', i, path[i], path[i+1]);
			return false;
		}
	}

	return true;
};

/**
 * Check if the line is valid
 * @param x1 {Number}   start x
 * @param y1 {Number}	start y
 * @param x2 {Number}	end x
 * @param y2 {Number}	end y
 */
//检测是否为直线路径
Map.prototype._checkLinePath = function(x1, y1, x2, y2) {
  var px = x2 - x1;
  var py = y2 - y1;
  var tile = this.tileW/2;   //半个瓦片宽度
	
//-------------我修改的部分代码-------------------------------------------------------------------修改bug
	
	//如果x坐标相同，检测y轴坐标之间是否有障碍物
  if(px === 0) {
    while(y1 < y2) {
      y1 += tile;
      if(!this.isReachable(x1, y1)) {
        return false;
      }
    }
    while(y1 > y2) {
      y1 -= tile;
      if(!this.isReachable(x1, y1)) {
        return false;
      }	    
    }
    return true;
  }

	//如果y坐标相同，检测x轴坐标之间是否有障碍物
  if(py === 0) {
    while(x1 < x2) {
      x1 += tile;
      if(!this.isReachable(x1, y1)) {
        return false;
      }
    }
    while(x1 > x2) {
      x1 -= tile;
      if(!this.isReachable(x1, y1)) {
        return false;
      }
    }
    return true;
  }
	
//  ---------原来代码部分----------------------------------------我觉得不合理,会被人利用这个bug开发穿墙外挂	
//  if(px === 0) {
//    while(x1 < x2) {
//      x1 += tile;
//      if(!this.isReachable(x1, y1)) {
//        return false;
//      }
//    }
//    return true;
//  }

//	//如果两坐标y相同，返回true
//  if(py === 0) {
//    while(y1 < y2) {
//      y1 += tile;
//      if(!this.isReachable(x1, y1)) {
//        return false;
//      }
//    }
//    return true;
//  }	
//-----------------------------------------------------------------------------
	
	//计算两坐标距离
  var dis = formula.distance(x1, y1, x2, y2);
  var rx = (x2 - x1) / dis;
  var ry = (y2 - y1) / dis;
  var dx = tile * rx;
  var dy = tile * ry;

  var x0 = x1;
  var y0 = y1;
  x1 += dx;
  y1 += dy;

	//沿着对角线循环增加一小段直到目标坐标，判断之间是否有障碍物，如果没有障碍物则最后返回true
  while((dx > 0 && x1 < x2) || (dx < 0 && x1 > x2)) {
    if(!this._testLine(x0, y0, x1, y1)) {
      return false;
    }

    x0 = x1;
    y0 = y1;
    x1 += dx;
    y1 += dy;
  }
  return true;
};

Map.prototype._testLine = function(x, y, x1, y1) {
	//先确定两检测坐标可走的
	if(!this.isReachable(x, y) || !this.isReachable(x1, y1)) {
		return false;
	}

	var dx = x1 - x;
	var dy = y1 - y;

	var tileX = Math.floor(x/this.tileW);
	var tileY = Math.floor(y/this.tileW);
	var tileX1 = Math.floor(x1/this.tileW);
	var tileY1 = Math.floor(y1/this.tileW);

	//如果两瓦片点呈水平或垂直排列，则为一直线，返回true
	if(tileX === tileX1 || tileY === tileY1) {
		return true;
	}

	//获取两坐标其中最小的y坐标
	var minY = y < y1 ? y : y1;
	//获取两坐标其中最大的y坐标
	var maxTileY = (tileY > tileY1 ? tileY : tileY1) * this.tileW;

	//最大y坐标等于最小y坐标，说明垂直排列一直线，返回true
	if((maxTileY-minY) === 0) {
		return true;
	}

	var y0 = maxTileY;
	var x0 = x + dx / dy * (y0 - y);

	var maxTileX = (tileX > tileX1 ? tileX : tileX1) * this.tileW;

	var x3 = (x0 + maxTileX) / 2;
	var y3 = y + dy / dx * (x3 - x);

	if(this.isReachable(x3, y3)) {
		return true;
	}
	return false;
};

/**
 * Change pos from tile pos to real position(The center of tile)
 * @param pos {Object} Tile position
 * @param tileW {Number} Tile width
 * @param tileH {Number} Tile height
 * @return {Object} The real position
 * @api public
 */
//将瓦片点转换为坐标（Map.findPath生成瓦片点路径转换成坐标路径用到）
function transPos(pos, tileW, tileH) {
	var newPos = {};
	newPos.x = pos.x*tileW + tileW/2;
	newPos.y = pos.y*tileH + tileH/2;

	return newPos;
}

/**
 * Test if the given three point is on the same line
 * @param p0 {Object}
 * @param p1 {Object}
 * @param p2 {Object}
 * @return {Boolean}
 * @api public
 */
//3点共线
function isLine(p0, p1, p2) {
	return ((p1.x-p0.x)===(p2.x-p1.x)) && ((p1.y-p0.y) === (p2.y-p1.y));
}

module.exports = Map;
