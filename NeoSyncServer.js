#!/usr/bin/env node
var fs = require('fs'),
	https = require('https'),
	http = require('http'),
	path = require('path'),
	open = require('open'),
	//io = require('socket.io')(2803);
	NeoSync = require('./NeoSyncClass.js').NeoSync;
	
var htmlDir = __dirname + path.sep + "html" + path.sep ;
//ns = new NeoSync({fetch:"nms:delivery=DM92123[html]"});
//ns = new NeoSync();
//ns.processFetch("nms:delivery=DM92123[html]");
	
//console.log(ns);
NeoSyncServer = function(){
	this.httpServer = http.createServer(this.onClientRequest.bind(this)).listen(2802);
	this.socket = require('socket.io')(this.httpServer);
	//this.testNeo = new NeoSync({ watch : true, onFileRefresh : this.onFileRefresh.bind(this) });
	//Init pour obtenir les informations
	NeoSync.initConfiguration();
	NeoSyncServer.initConfiguration();
	
	this.currentPath = process.cwd() +  path.sep;
	this.dirElements = this.getDirElements();

	this.socket.on('connection', function(socket){
		socket.on('changeDirectory', function(mess)
			{
				//console.log(mess);
				this.changeDirectory(mess);
			}.bind(this))
			.on('push', function(mess)
			{
				//console.log(mess);
				this.pushFile(mess);
			}.bind(this))
			.on('fetch', function(mess)
			{
				//console.log(mess);
				this.fetchFile(mess);
			}.bind(this))
			.on('addWatch', function(mess)
			{
				//console.log(mess);
				this.addWatcher(mess);
			}.bind(this))			
			.on('removeWatch', function(mess)
			{
				//console.log(mess);
				this.removeWatcher(mess);
			}.bind(this))			
			.on('openFolder', function(mess)
			{
				//console.log(mess);
				this.openFolder(mess);
			}.bind(this));
			
	}.bind(this));

	//open('http://localhost:2802/');


	if (process.platform === "win32") {
		getWindowsDrives();
	}
}
NeoSyncServer.prototype.onFileRefresh = function(obj){
	//console.log( " onTestFileRefresh :" + obj.nFile.fileName );
	//this.socket.emit('refreshInformation', JSON.stringify( {lastFile : obj.nFile.fileName , currentPath: process.cwd()} ));
	this.historyFiles.push({date : (new Date()).getTime(), file : obj.nFile });
	this.sendInfo();
}
NeoSyncServer.prototype.onClientRequest = function(request, response){
		var reqDatas = "";
	//console.log(request.url);
	if(request.url.indexOf("/refreshInformations") == 0 ){
		console.log(request.url)
		var result = this.refreshInformations( );
		response.end( this.getInfoAsString() );
	}
	else if(request.url.indexOf("/changeDirectory") == 0)
		{
			this.changeDirectory();
			response.end(fs.readFileSync(htmlDir + 'stations.json'));
		}
	else if(request.url.indexOf("/listStations") == 0)
		{response.end(fs.readFileSync(htmlDir + 'stations.json'));}
	else
		response.end(fs.readFileSync(htmlDir + 'index.html'));
}
NeoSyncServer.prototype.refreshInformations = function(){
	var obj = {};
	obj.currentPath = process.cwd();
	return obj;
} 
NeoSyncServer.prototype.historyFiles = new Array();
NeoSyncServer.prototype.neoSyncList = {};
NeoSyncServer.prototype.sendInfo = function(){
	this.socket.emit('refreshInformation', 	this.getInfoAsString());
	if( typeof this.infoListener == "function")
		this.infoListener( this.getInfoAsString() );
};
NeoSyncServer.prototype.addInfoListener = function( fn ){
	this.infoListener = fn;
}
NeoSyncServer.prototype.changeDirectory = function( newDirectory ){
	console.log('CHANGE DIR' + newDirectory);
	if( newDirectory.indexOf( path.sep ) == 0 || 
		(process.platform === "win32" && newDirectory.match(/([A-z]\:)/) ) )
	{
		this.currentPath = newDirectory;
	}
	else if( newDirectory == '..')
		{ 
		newDirectory = "";
		var dirRegExp = "(.*)\\" + path.sep + "[^\\" + path.sep + "].*$";
		if( this.currentPath.match(dirRegExp) && this.currentPath.match(dirRegExp).length > 1)
			newDirectory = this.currentPath.match(dirRegExp)[1] + path.sep;
		/*
		else if( this.currentPath.indexOf('/') == 0)
			newDirectory = "/";
		if( newDirectory == "")
			newDirectory = "/";			
			*/
		console.log("NEW DIRECTORY " + newDirectory);
		this.currentPath = newDirectory ;
		}
	else
		this.currentPath = this.currentPath + newDirectory + path.sep;
	
	//newDirectory + path.sep;
	this.dirElements = this.getDirElements();
	this.sendInfo();
};
NeoSyncServer.prototype.addWatcher = function( directory ){
	var key = "NEOSYNC_" + (new Date()).getTime();
	if(!directory.match("\\" + path.sep + "$"))
		directory += path.sep;
	this.neoSyncList[key] = new NeoSync({ directory : directory, watch : true, onFileRefresh : this.onFileRefresh.bind(this)});
	this.sendInfo();
};
NeoSyncServer.prototype.removeWatcher = function( directory ){
	//var key = "NEOSYNC_" + (new Date()).getTime();
	for(var i in this.neoSyncList)
	{
		var ns = this.neoSyncList[i];
		if(ns.directory == directory)
		{
			ns.kill();
			delete this.neoSyncList[i];
			//this.neoSyncList[i] = null;
		}
	}
	
	this.sendInfo();
};
NeoSyncServer.prototype.pushFile = function( fetch ){
	var pushNS = new NeoSync({ push : this.currentPath + fetch, onFileRefresh : this.onFileRefresh.bind(this) });
	this.sendInfo();
};
NeoSyncServer.prototype.fetchFile = function( fetch ){
	//var fetch = NeoSync.getFetchFromFile( this.currentPath + file );
	//On met tout en pause le temps du fetch
	this.pauseAllWatch();
	console.log("ON VA FETCHER" + fetch);	
	//On fetch et une fois fini, on relance tout
	var fetchNS = new NeoSync({ fetch : this.currentPath + fetch, onFetchDone : this.onFetchDone.bind(this) });
	//this.sendInfo();
};
NeoSyncServer.prototype.onFetchDone = function(){
	this.playAllWatch();
	this.dirElements = this.getDirElements();	
	this.sendInfo();
}
NeoSyncServer.prototype.getInfoAsString = function(){
	Neoconfig = NeoSync.config;
	//delete Neoconfig.sessionToken;
	//delete Neoconfig.userPwd;
	return JSON.stringify( 
		{
			historyFiles : this.historyFiles , 
			currentPath: this.currentPath,
			//currentWatch : this.neoSyncList,
			currentWatches : this.getNeoSyncList(),
			dirElements : this.dirElements,
			NeoConf : Neoconfig,
			pathSep : path.sep,
			configFiles : NeoSyncServer.configFiles
		} );
};
NeoSyncServer.prototype.getNeoSyncList = function(){
	var neoSyncList = new Array();
	for(var i in this.neoSyncList)
		neoSyncList.push({key:i, path:this.neoSyncList[i].directory});
	return neoSyncList;
};
NeoSyncServer.prototype.pauseAllWatch = function(){
	for(var i in this.neoSyncList)
		this.neoSyncList[i].pauseWatch();	
};
NeoSyncServer.prototype.playAllWatch = function(){
	setTimeout(function(){
	console.log("On relance tout");
	for(var i in this.neoSyncList)
		this.neoSyncList[i].playWatch();
		}.bind(this),500);
};
NeoSyncServer.prototype.openFolder = function( folder ){
	var extensionReg = /\.([^\.]*)$/;
	var ext = "";
	if( folder.match(extensionReg) )
		ext = folder.match(extensionReg)[1];
	console.log('EXT : ' + ext);
	console.log('NeoSyncServer.config.filesEditor : ' + NeoSyncServer.config.filesEditor);
	if( NeoSyncServer.config.filesEditor && NeoSyncServer.config.filesEditor[ext])
		open( folder, NeoSyncServer.config.filesEditor[ext] );
	else
		open( folder );
}
NeoSyncServer.prototype.getDirElements = function(){
	var dirs = [];
	console.log( "PATH : "+ (process.platform == 'win32' && this.currentPath == "\\"));
	if( process.platform == 'win32' && this.currentPath == "")
		return NeoSync.winDrives;

	try{
	var allFiles = fs.readdirSync(this.currentPath); 
	}
	catch( e ){
		console.log(e);
		return [];
	}
    for (var index = 0; index < allFiles.length; index++) { 
    	try{
        file = allFiles[index]; 
        if (file[0] !== '.') { 
            filePath = this.currentPath + path.sep + file;             
            var stat = fs.statSync(filePath);
            var type = "file";
            var nFetch = null;
            var fetchDetails = null;
            if (stat.isDirectory()) 
                type = "dir"; 
            if( type == 'file')
            	{
            		nFetch = NeoSync.getFetchFromFile( filePath );
            		fetchDetails = NeoSync.FetchRequest( this.currentPath + path.sep + nFetch );
            	}
            
            dirs.push({"type" : type, "name" : file, "fetch" : nFetch, "fetchDetails" : fetchDetails});             
        }
        }
        catch( err ){
        	console.log( err );
        }
    }
    return dirs;
    
	
}
NeoSyncServer.config = {};
NeoSyncServer.initConfiguration = function(){
	var initFile = getUserHome() + path.sep + 'NeoSync' + path.sep + 'neoSyncServer.conf';
	//console.log( initFile );
	try{
		var configLines = fs.readFileSync( initFile );		
		NeoSyncServer.config = JSON.parse( configLines );
		}
	catch( err ){
		console.log( "NeoSyncServer : pas de fichier de configuration " + err);		
	}
	
}

function getUserHome() {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}
var nsServer = new NeoSyncServer();
NeoSyncServer.configFiles = NeoSync.getConfigurations();

exports.NeoSyncServer = nsServer;

/*Workarround for windows drives*/
NeoSync.winDrives = new Array();
var tmpWinDrives = new Array();
function getWindowsDrives(){
	tmpWinDrives = new Array();
var spawn = require('child_process').spawn,
    list  = spawn('cmd');

    list.stdout.on('data', function (data) {
	data = data.toString()
   	var driveRegEx = /[a-zA-Z]\:/g;
	console.log('stdout: ' + data);
	while( (matched = driveRegEx.exec( data )) !== null)
		{
		  console.log('stdout matched: ' + matched[0]);
		  if( tmpWinDrives.indexOf( matched[0]) == -1 )
		  	{
		  		tmpWinDrives.push( matched[0] );
		  		NeoSync.winDrives.push( { "type" : "dir" , "name" : matched[0] + "\\"} );
			}
		}
	});

	list.stderr.on('data', function (data) {
	  //console.log('stderr: ' + data);
	});

	list.on('exit', function (code) {
	  //console.log('child process exited with code ' + code);
	  console.log(NeoSync.winDrives);	
	});

	list.stdin.write('wmic logicaldisk get name\n');
	list.stdin.end();
}