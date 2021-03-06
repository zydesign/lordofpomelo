/**
 * Module dependencies
 */
var messageService = require('../../../domain/messageService');
var logger = require('pomelo-logger').getLogger(__filename);
var consts = require('../../../consts/consts');
var utils = require('../../../util/utils');
var dataApi = require('../../../util/dataApi');


//队伍逻辑脚本
module.exports = function(app) {
  return new Handler(app);
};

var Handler = function(app) {
  this.app = app;
  this.teamNameArr = dataApi.team.all(); //队名数据组
  this.teamNameArr.length = Object.keys(this.teamNameArr).length; //队名数量
  // utils.myPrint('teamNameArr = ', JSON.stringify(this.teamNameArr));
};

/**
 * Player create a team, and response the result information : success(1)/failed(0)
 * @param {Object} msg
 * @param {Object} session
 * @param {Function} next
 * @api public
 */

//客户端发起，创建队伍-----------------------------------------------------------------------------------------【创建队伍】
Handler.prototype.createTeam = function(msg, session, next) {
  var area = session.area;
  var playerId = session.get('playerId');
  utils.myPrint('Handler ~ createTeam is running ... ~ playerId = ', playerId);
  var player = area.getPlayer(playerId);

  //角色不存在
  if(!player) {
    logger.warn('The request(createTeam) is illegal, the player is null : msg = %j.', msg);
    next();
    return;
  }

  // if the player is already in a team, can't create team
  // 玩家已在队伍中，不能创建
  if(player.teamId !== consts.TEAM.TEAM_ID_NONE) {
    logger.warn('The request(createTeam) is illegal, the player is already in a team : msg = %j.', msg);
    next();
    return;
  }

  // 队名id，队名数据组里面任意id
  var tmpIdx = Math.floor((Math.random() * this.teamNameArr.length) + 1);
  // 生成队伍名
  var teamName = this.teamNameArr[tmpIdx] ? this.teamNameArr[tmpIdx].teamName : consts.TEAM.DEFAULT_NAME;
  // 获取当前服务器id，即后端id
  var backendServerId = this.app.getServerId();
  var result = consts.TEAM.JOIN_TEAM_RET_CODE.SYS_ERROR; 
  var playerInfo = player.toJSON4TeamMember();  //通过player获取的不完整的队员信息
  
  // 生成队员数据（队员数据可以生成完整队员信息）
  var args = {teamName: teamName, playerId: playerId, areaId: area.areaId, userId: player.userId,
    serverId: player.serverId, backendServerId: backendServerId, playerInfo: playerInfo};
  
  
  //rpc到manager服务器，作为队长创建队伍。（返回ret：{result: result, teamId: teamObj.teamId}）---------创建队伍
  this.app.rpc.manager.teamRemote.createTeam(session, args,
    function(err, ret) {
      utils.myPrint("ret.result = ", ret.result);
      utils.myPrint("typeof ret.result = ", typeof ret.result);
      result = ret.result;
      var teamId = ret.teamId;
      utils.myPrint("result = ", result);
      utils.myPrint("teamId = ", teamId);
    
    //如果建队成功，执行player添加teamId属性
      if(result === consts.TEAM.JOIN_TEAM_RET_CODE.OK && teamId > consts.TEAM.TEAM_ID_NONE) {
        //执行给player添加teamId属性---------------------------------------------------player添加teamId属性
        if(!player.joinTeam(teamId)) {
          result = consts.TEAM.JOIN_TEAM_RET_CODE.SYS_ERROR;
        }
      }
      utils.myPrint("player.teamId = ", player.teamId);
    
    //如果建队成功，而且playe添加了teamId属性。执行player添加isCaptain属性
      if(result === consts.TEAM.JOIN_TEAM_RET_CODE.OK && player.teamId > consts.TEAM.TEAM_ID_NONE) {
        //player添加isCaptain属性----------------------------------------------------player添加isCaptain属性
        player.isCaptain = consts.TEAM.YES;
        var ignoreList = {};
        //aoi推送消息给附近玩家（包括自己）。 （显示：队长xxx创建了队伍teamName）
        messageService.pushMessageByAOI(area,
          {
            route: 'onTeamCaptainStatusChange',      //队长状态改变
            playerId: playerId,                      //队长playerId 
            teamId: player.teamId,                   //队长teamId
            isCaptain: player.isCaptain,             //队长isCaptain
            teamName: teamName                       //队伍名
          },
          {x: player.x, y: player.y}, ignoreList);
      }

      next();
    });
};

/**
 * Captain disband the team, and response the result information : success(1)/failed(0)
 *
 * @param {Object} msg
 * @param {Object} session
 * @param {Function} next
 * @api public
 */
//客户端发起，解散队伍，只有队长才能解散队伍---------------------------------------------------------------【解散队伍】
Handler.prototype.disbandTeam = function(msg, session, next) {
  var area = session.area;
  var playerId = session.get('playerId');
  var player = area.getPlayer(playerId);

  if(!player) {
    logger.warn('The request(disbandTeam) is illegal, the player is null : msg = %j.', msg);
    next();
    return;
  }

  //如果玩家没有队伍，或者参数要解散的队伍id跟玩家的队伍id不一致。
  if(player.teamId <= consts.TEAM.TEAM_ID_NONE || msg.teamId !== player.teamId) {
    logger.warn('The request(disbandTeam) is illegal, the teamId is wrong : msg = %j.', msg);
    next();
    return;
  }

  utils.myPrint('playerId, IsInTeamInstance = ', playerId, player.isInTeamInstance);
  
  //如果玩家在副本里面，不能解散
  if (player.isInTeamInstance) {
    next();
    return;
  }

  //如果玩家不是队长，不能解散
  if (!player.isCaptain) {
    logger.warn('The request(disbandTeam) is illegal, the player is not the captain : msg = %j.', msg);
    next();
    return;
  }

  var result = consts.TEAM.FAILED;

  var args = {playerId: playerId, teamId: player.teamId};
  //rpc到管理服务器解散队伍，通过角色playerId和角色的teamId------------------------------------------解散队伍
  //返回ret：{result: consts.TEAM.OK}
  this.app.rpc.manager.teamRemote.disbandTeamById(session, args,
    function(err, ret) {
      result = ret.result;
      utils.myPrint("1 ~ result = ", result);
      if(result === consts.TEAM.OK) {
        if (player.isCaptain) {
          player.isCaptain = consts.TEAM.NO;   //player去掉isCaptain属性----------------------player去掉isCaptain属性
          var ignoreList = {};
          //aoi推送消息，通知周围玩家（包括自己）。（显示：队长xxx解散了队伍）
          messageService.pushMessageByAOI(area,
            {
              route: 'onTeamCaptainStatusChange',    //队长状态改变
              playerId: playerId,                    //队长playerId
              teamId: player.teamId,                 //队长teamId
              isCaptain: player.isCaptain,           //队长isCaptain
              teamName: consts.TEAM.DEFAULT_NAME     //默认队伍名（空）
            },
            {x: player.x, y: player.y}, ignoreList);
        }
      }
    });

  next();
};

/**
 * Notify: Captain invite a player to join the team, and push invitation to the invitee
 *
 * @param {Object} msg
 * @param {Object} session
 * @param {Function} next
 * @api public
 */
// 客户端发起，邀请加入队伍，只有队长才能发起邀请---------------------------------------------------------------【队长邀请加入队伍】
Handler.prototype.inviteJoinTeam = function(msg, session, next) {
  var area = session.area;
  var captainId = session.get('playerId');      //session获取的playerId
  var captainObj = area.getPlayer(captainId);   //队长实体

  // 如果场景获取玩家不存在
  if(!captainObj) {
    logger.warn('The request(inviteJoinTeam) is illegal, the player is null : msg = %j.', msg);
    next();
    return;
  }

  var inviteeObj = area.getPlayer(msg.inviteeId);    //被邀请人实体
  if(!inviteeObj) {
    logger.warn('The request(inviteJoinTeam) is illegal, the invitee is null : msg = %j.', msg);
    next();
    return;
  }

  // send invitation to the invitee
  var args = {captainId: captainId, teamId: msg.teamId};  //队长id，队伍id
  //rpc到管理服务器邀请加入队伍-------------------------------------------------------------------邀请加入队伍
  //rpc返回ret：{result: consts.TEAM.OK}或{result: consts.TEAM.FAILED}
  this.app.rpc.manager.teamRemote.inviteJoinTeam(session, args, function(err, ret) {
    var result = ret.result;
    utils.myPrint("result = ", result);
    //如果邀请成功，生成队长队伍信息，发送给被邀请玩家，“告知xxx邀请他加入xxx队伍”--------------------通知被邀请人，谁发起的队伍邀请
    if(result === consts.TEAM.OK) {
      var captainInfo = captainObj.toJSON4Team();
      messageService.pushMessageToPlayer({uid : inviteeObj.userId, sid : inviteeObj.serverId},
        'onInviteJoinTeam', captainInfo);
    }
  });
  next();
};

/**
 * Request: invitee reply to join the team's captain, response the result, and push msg to the team members
 *
 * @param {Object} msg
 * @param {Object} session
 * @param {Function} next
 * @api public
 */
//客户端发起，被邀请人接受（或拒绝）队伍邀请----------------------------------------------------------【接受（或拒绝）队伍邀请】
Handler.prototype.inviteJoinTeamReply = function(msg, session, next) {
  var area = session.area;
  var inviteeId = session.get('playerId');
  var inviteeObj = area.getPlayer(inviteeId);  //被邀请人实体

  //如果场景中获取不到被邀请人
  if(!inviteeObj) {
    logger.warn('The request(inviteJoinTeamReply) is illegal, the player is null : msg = %j.', msg);
    next();
    return;
  }

  var captainObj = area.getPlayer(msg.captainId);   //队长实体
  if(!captainObj) {
    logger.warn('The request(inviteJoinTeamReply) is illegal, the captain is null : msg = %j.', msg);
    next();
    return;
  }

  //如果参数提供的teamId跟队长的不一致
  if (msg.teamId !== captainObj.teamId) {
    logger.warn('The request(inviteJoinTeamReply) is illegal, the teamId is wrong : msg = %j.', msg);
    next();
    return;
  }

  var result = consts.TEAM.JOIN_TEAM_RET_CODE.SYS_ERROR;
  var backendServerId = this.app.getServerId();            //后端id
  
  //如果【参数reply值】为：接受邀请-----------------------------------------------------《《《如果【参数reply值】为：接受邀请时》》》
  if(msg.reply === consts.TEAM.JOIN_TEAM_REPLY.ACCEPT) {
    var inviteeInfo = inviteeObj.toJSON4TeamMember();         //被邀请人player生成不完整队员信息
    
    //生成队员数据，提供生成完整队员信息
    var args = {captainId: msg.captainId, teamId: msg.teamId,
      playerId: inviteeId, areaId: area.areaId, userId: inviteeObj.userId,
      serverId: inviteeObj.serverId, backendServerId: backendServerId,
      playerInfo: inviteeInfo};
    //rpc到管理服务器，接受邀请，加入队伍---------------------------------------------------------接受队伍邀请，加入队伍
    //rpc返回cb：{result: result, teamName: teamName}
    this.app.rpc.manager.teamRemote.acceptInviteJoinTeam(session, args, function(err, ret) {
      utils.myPrint('AcceptInviteJoinTeam ~ ret = ', JSON.stringify(ret));
      result = ret.result;
      
      //如果受邀加入队伍成功-----------------------------------------------------------------------如果受邀加入队伍成功，发aoi通知
      if(result === consts.TEAM.JOIN_TEAM_RET_CODE.OK) {
        //执行player.joinTeam，添加player.teamId属性--------------------------添加player.teamId属性
        //如果msg.teamId不存在，无法加入队伍，通知‘队长’：无法入队
        if(!inviteeObj.joinTeam(msg.teamId)) {
          result = consts.TEAM.JOIN_TEAM_RET_CODE.SYS_ERROR;
          //通知队长
          messageService.pushMessageToPlayer({uid: captainObj.userId, sid: captainObj.serverId},
            'onInviteJoinTeamReply', {reply: result});
        } else {
          //如果被邀请人添加player.teamId属性成功，就算正式加入队伍了
          inviteeObj.isCaptain = consts.TEAM.NO;  //不是队长，即队员-----------添加player.isCaptain属性
          var ignoreList = {};
          //aoi通知附近玩家（包括被邀请人自己）。（显示：队员xxx加入了xxx队伍）----------------队员接受队长邀请加入队伍，aoi通知
          messageService.pushMessageByAOI(area,
            {
              route: 'onTeamMemberStatusChange',  //队员状态变化
              playerId: inviteeId,                //被邀请人playerId
              teamId: inviteeObj.teamId,          //被邀请人teamId
              isCaptain: inviteeObj.isCaptain,    //被邀请人isCaptain
              teamName: ret.teamName              //队伍名
            },
            {x: inviteeObj.x, y: inviteeObj.y}, ignoreList);
        }
        utils.myPrint('invitee teamId = ', inviteeObj.teamId);
      } else {
        
        // 如果受邀加入队伍失败，通知队长----------------------------------------------------------如果受邀加入队伍失败，通知队长
        messageService.pushMessageToPlayer({uid: captainObj.userId, sid: captainObj.serverId},
          'onInviteJoinTeamReply', {reply: result});
      }
    });
  } else {
    // push msg to the inviter(the captain) that the invitee reject to join the team
    //如果【参数reply值】为：拒绝邀请--------------------------------------------------《《《如果【参数reply值】为：拒绝邀请时》》》
    //通知队长：邀请被拒绝了
    messageService.pushMessageToPlayer({uid: captainObj.userId, sid: captainObj.serverId},
      'onInviteJoinTeamReply', {reply: result});
  }
  next();
};

/**
 * Notify: applicant apply to join the team, and push the application to the captain
 *
 * @param {Object} msg
 * @param {Object} session
 * @param {Function} next
 * @api public
 */
//客户端发起，申请入队----------------------------------------------------------------------------------【申请入队】
Handler.prototype.applyJoinTeam = function(msg, session, next) {
  utils.myPrint('ApplyJoinTeam ~ msg = ', JSON.stringify(msg));
  var area = session.area;
  var applicantId = session.get('playerId');
  var applicantObj = area.getPlayer(applicantId);   //申请人实体

  if(!applicantObj) {
    logger.warn('The request(applyJoinTeam) is illegal, the player is null : msg = %j.', msg);
    next();
    return;
  }

  if(applicantObj.isInTeam()) {
    next();
    return;
  }

  var captainObj = area.getPlayer(msg.captainId);  //队长实体
  if(!captainObj) {
    logger.warn('The request(applyJoinTeam) is illegal, the captain is null : msg = %j.', msg);
    next();
    return;
  }

  if(captainObj.teamId !== msg.teamId) {
    logger.warn('The request(applyJoinTeam) is illegal, the teamId is wrong : msg = %j.', msg);
    next();
    return;
  }
  // send the application to the captain
  var args = {applicantId: applicantId, teamId: msg.teamId};
  //rpc到管理服务器，申请入队------------------------------------------------------------------申请入队
  //rpc返回ret：{result: consts.TEAM.FAILED}或{result: consts.TEAM.OK}
  this.app.rpc.manager.teamRemote.applyJoinTeam(session, args, function(err, ret) {
    var result = ret.result;
    utils.myPrint("result = ", result);
    //如果申请ok
    if(result === consts.TEAM.OK) {
      var applicantInfo = applicantObj.toJSON4Team();  //申请人player生成不完整队员信息
      //通知队长，有人申请入队。（显示：xxx申请入队）--------------------------------------------通知队长，有人申请入队
      messageService.pushMessageToPlayer({uid: captainObj.userId, sid: captainObj.serverId},
        'onApplyJoinTeam', applicantInfo);
    }
  });
  next();
};

/**
 * Notify: captain reply the application, and push msg to the team members(accept) or only the applicant(reject)
 *
 * @param {Object} msg
 * @param {Object} session
 * @param {Function} next
 * @api public
 */
//客户端发起，队长接受（或拒绝）入队申请-------------------------------------------------------------------【接受（或拒绝）入队申请】
Handler.prototype.applyJoinTeamReply = function(msg, session, next) {
  var area = session.area;
  var playerId = session.get('playerId');
  var player = area.getPlayer(playerId);      //队长实体

  if(!player) {
    logger.warn('The request(applyJoinTeamReply) is illegal, the player is null : msg = %j.', msg);
    next();
    return;
  }

  //如果玩家不是队长或玩家的teamId跟参数的不一致
  if (!player.isCaptain || player.teamId !== msg.teamId) {
    logger.warn('The request(applyJoinTeamReply) is illegal, the teamId is wrong : msg = %j.', msg);
    next();
    return;
  }

  var applicantObj = area.getPlayer(msg.applicantId);  //申请人实体
  if(!applicantObj) {
    logger.warn('The request(applyJoinTeamReply) is illegal, the applicantObj is null : msg = %j.', msg);
    next();
    return;
  }

  //如果申请人有队伍
  if(applicantObj.isInTeam()) {
    next();
    return;
  }

  //如果【参数reply值】为：接受入队申请------------------------------------------------------《《《【参数reply值】为：接受入队申请时》》》
  if(msg.reply === consts.TEAM.JOIN_TEAM_REPLY.ACCEPT) {
    var result = consts.TEAM.JOIN_TEAM_RET_CODE.SYS_ERROR;
    var applicantInfo = applicantObj.toJSON4TeamMember();  //申请人player生成不完整队员信息
    var backendServerId = this.app.getServerId();          //后端id
    
    //生成队员数据，提供生成完整队员信息
    var args = {captainId: playerId, teamId: msg.teamId,
      playerId: msg.applicantId, areaId: area.areaId, userId: applicantObj.userId,
      serverId: applicantObj.serverId, backendServerId: backendServerId,
      playerInfo: applicantInfo};
    //rpc到管理服务器，接受入队申请------------------------------------------------------------------接受入队申请
    //rpc返回ret：{result: result, teamName: teamName}
    this.app.rpc.manager.teamRemote.acceptApplicantJoinTeam(session, args, function(err, ret) {
      utils.myPrint('ApplyJoinTeamReply ~ ret = ', JSON.stringify(ret));
      result = ret.result;
      
      //如果添加队员成功-------------------------------------------------------------------------如果添加队员成功，发aoi通知
      if(result === consts.TEAM.JOIN_TEAM_RET_CODE.OK) {
        //执行player.joinTeam，添加player.teamId属性----------------------------添加player.teamId属性
        //如果msg.teamId不存在，通知‘申请人’：无法入队
        if(!applicantObj.joinTeam(msg.teamId)) {
          result = consts.TEAM.JOIN_TEAM_RET_CODE.SYS_ERROR;
          messageService.pushMessageToPlayer({uid: applicantObj.userId, sid: applicantObj.serverId},
            'onApplyJoinTeamReply', {reply: result});
        } else {
          //如果申请人添加player.teamId属性成功，就算正式加入队伍了
          applicantObj.isCaptain = consts.TEAM.NO;  //不是队长，即队员-----------添加player.isCaptain属性
          var ignoreList = {};
           //aoi通知附近玩家（包括队长自己）。（显示：队员xxx加入了xxx队伍）--------------------队长接受了队员加入队伍，aoi通知
          messageService.pushMessageByAOI(area,
            {
              route: 'onTeamMemberStatusChange',  //队员状态变化
              playerId: msg.applicantId,          //申请人playerId
              teamId: applicantObj.teamId,        //申请人teamId
              isCaptain: applicantObj.isCaptain,  //申请人isCaptain
              teamName: ret.teamName              //队伍名
            },
            {x: applicantObj.x, y: applicantObj.y}, ignoreList);
        }
        utils.myPrint('applicantObj teamId = ', applicantObj.teamId);
      } else {
        //如果添加队员失败-------------------------------------------------------------------------如果添加队员失败，发aoi通知
        messageService.pushMessageToPlayer({uid: applicantObj.userId, sid: applicantObj.serverId},
          'onApplyJoinTeamReply', {reply: ret.result});
      }
    });
  } else {
    // push tmpMsg to the applicant that the captain rejected
    //如果【参数reply值】为：拒绝入队-------------------------------------------------《《《【参数reply值】为：接受入队时》》》
    //通知申请人：被拒绝入队了
    messageService.pushMessageToPlayer({uid: applicantObj.userId, sid: applicantObj.serverId},
      'onApplyJoinTeamReply', {reply: consts.TEAM.JOIN_TEAM_REPLY.REJECT});
  }
  next();
};

/**
 * Captain kicks a team member, and push info to the kicked member and other members
 *
 * @param {Object} msg
 * @param {Object} session
 * @param {Function} next
 * @api public
 */
//踢出队员。只要队长才有资格踢队员。-----------------------------------------------------------------------------【踢出队员】
Handler.prototype.kickOut = function(msg, session, next) {
  var area = session.area;
  var captainId = session.get('playerId');
  var captainObj = area.getPlayer(captainId);   //队长实体

  if(!captainObj) {
    logger.warn('The request(kickOut) is illegal, the captainObj is null : msg = %j.', msg);
    next();
    return;
  }

  //如果被动踢人队长自己，不能踢
  if(captainId === msg.kickedPlayerId) {
    logger.warn('The request(kickOut) is illegal, the kickedPlayerId is captainId : msg = %j.', msg);
    next();
    return;
  }

  //如果队长没有player.teamId，或参数的teamId跟队长的不一致，不能踢人
  if(captainObj.teamId <= consts.TEAM.TEAM_ID_NONE || msg.teamId !== captainObj.teamId) {
    logger.warn('The request(kickOut) is illegal, the teamId is wrong : msg = %j.', msg);
    next();
    return;
  }

  utils.myPrint('captainId, IsInTeamInstance = ', captainId, captainObj.isInTeamInstance);
  //如果队长在副本里，不能踢人
  if (captainObj.isInTeamInstance) {
    next();
    return;
  }

  var args = {captainId: captainId, teamId: msg.teamId, kickedPlayerId: msg.kickedPlayerId};
  //rpc到管理服务器，踢出队员-------------------------------------------------------------踢出队员
  //rpc返回ret： {result: consts.TEAM.FAILED}或 {result: consts.TEAM.OK}
  this.app.rpc.manager.teamRemote.kickOut(session, args,
    function(err, ret) {
    });
  next();
};

/**
 * member leave the team voluntarily, and push info to other members
 *
 * @param {Object} msg
 * @param {Object} session
 * @param {Function} next
 * @api public
 */
//客户端发起，玩家主动离队----------------------------------------------------------------------------【玩家主动离队】
Handler.prototype.leaveTeam = function(msg, session, next) {
  var area = session.area;
  var playerId = session.get('playerId');
  var player = area.getPlayer(playerId);     //玩家实体

  //如果玩家不在场景中，返回
  if(!player) {
    logger.warn('The request(leaveTeam) is illegal, the player is null: msg = %j.', msg);
    next();
    return;
  }

  utils.myPrint('playerId, IsInTeamInstance = ', playerId, player.isInTeamInstance);
  //如果玩家在副本里，不能离队
  if (player.isInTeamInstance) {
    next();
    return;
  }

  var result = consts.TEAM.FAILED;

  utils.myPrint("player.teamId = ", player.teamId);
  utils.myPrint("typeof player.teamId = ", typeof player.teamId);

  utils.myPrint("msg.teamId = ", msg.teamId);
  utils.myPrint("typeof msg.teamId = ", typeof msg.teamId);

  //如果玩家没有队伍，或者跟客户端发来的teamId不匹配。不能离队
  if(player.teamId <= consts.TEAM.TEAM_ID_NONE || player.teamId !== msg.teamId) {
    logger.warn('The request(leaveTeam) is illegal, the teamId is wrong: msg = %j.', msg);
    next();
    return;
  }
 
  var args = {playerId: playerId, teamId: player.teamId};
  //rpc到管理服务器，主动离队-------------------------------------------------------------------主动离队
  //rpc返回ret：{result: consts.TEAM.FAILED}或{result: consts.TEAM.OK}
  this.app.rpc.manager.teamRemote.leaveTeamById(session, args,
    function(err, ret) {
      result = ret.result;
      utils.myPrint("1 ~ result = ", result);
    //如果离队成功，而且player.teamId已经归零，不需要aoi消息（如果player.teamId未归零，就需要aoi推送消息）-------检查是否player.teamId归零
    //PS：在rpc到area/remote/playerRemote.leaveTeam时，是进行player.teamId归零，并aoi推送消息的
    //一般这里的aoi推送不需要的，因为player.teamId肯定归零了
      if(result === consts.TEAM.OK && !player.leaveTeam()) {
        result = consts.TEAM.FAILED;
      }
    //aoi推送消息，（显示：xxx离开了队伍。如果是队长，多一个xxx解散了队伍）
      if (result === consts.TEAM.OK) {
        var route = 'onTeamMemberStatusChange';   //队员状态改变
        //如果离队的是队长
        if(player.isCaptain) {
          route = 'onTeamCaptainStatusChange';    //队长状态改变
          player.isCaptain = consts.TEAM.NO;      //修改player.isCaptain归零
        }
        var ignoreList = {};
        messageService.pushMessageByAOI(area,
          {
            route: route,                         //路由
            playerId: playerId,                   //离队人playerId
            teamId: player.teamId,                //离队人teamId
            isCaptain: player.isCaptain,          //离队人isCaptain
            teamName: consts.TEAM.DEFAULT_NAME    //默认队伍名（空）
          },
          {x: player.x, y: player.y}, ignoreList);
      }

      utils.myPrint("teamId = ", player.teamId);
    });

  next();
};
