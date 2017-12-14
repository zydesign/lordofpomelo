var AiManager = require('./service/aiManager');
var BrainService = require('./service/brainService');
var fs = require('fs');
var path = require('path');

var exp = module.exports;
//此脚本只要由area脚本引用，并创建AiManager实例，把储存过大脑的brainService添加到参数opt中

//创建一个AiManager实例，主要是给参数添加大脑服务brainService实例属性，注册大脑到brainService中，方便调用
//参数opts为{{area:area}}，场景类area提供
exp.createManager = function(opts) {
	var brainService = new BrainService();  //实例大脑服务
	
	// 遍历brain目录下的所有脚本，然后把该目录下的大脑注册储存到brainService服务大脑对象组
	fs.readdirSync(__dirname + '/brain').forEach(function(filename){
		//解析：/.../x,表示x文件夹里，查找某文件，反斜杠\表示查找内容
		//这里是在test文件夹里面查找带js脚本的文件
		if (!/\.js$/.test(filename)) {
			return;
		}
		var name = path.basename(filename, '.js');
		var brain = require('./brain/' + name);
		brainService.registerBrain(brain.name||name, brain);
	});

	opts = opts || {};
	//给参数添加属性，大脑服务
	opts.brainService = brainService;
	return new AiManager(opts);
};
