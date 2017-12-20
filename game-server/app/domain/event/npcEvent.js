var api = require('../../util/dataApi');
var consts = require('../../consts/consts');
var messageService = require('./../messageService');

var exp = module.exports;

/**
 * Handler npc event
 */

//NPC事件监听
exp.addEventForNPC = function (npc){
	/**
	 * Hanlde npc talk event
	 */
	npc.on('onNPCTalk', function(data){
		var npc = data.npc;
		var player = data.player;
		var talk = api.talk; //读取talk表，实例一份数据
		//通过对话id，获取对应npc的对话数据对象，返回值是数组，但数组里只有一个对象
		var npcTalks = talk.findBy('npc', npc.kindId);  //kindId是area在初始化initNPCs时，实例npc实体加入的属性，实位NPC对应的值
		var npcword = 'Welcome to see you!';
		var myword = 'Me too!';

		if(!!npcTalks && npcTalks.length > 0){
			npcword = npcTalks[0].npcword;
			myword = npcTalks[0].myword;
		}

		//生成要广播给玩家的消息
		var msg = {
			npc : npc.entityId,
			npcword : npcword,
			myword: myword,
			player : player.entityId,
			kindId : npc.kindId
		};

		if (consts.TraverseNpc[npc.kindId]) {
			npc.traverse('onNPCTalk', msg);
			return;
		}

		//广播消息给该玩家
		messageService.pushMessageToPlayer({uid:player.userId, sid: player.serverId}, 'onNPCTalk', msg);
	});
};
