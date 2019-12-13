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
//process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';	
//console.log(ns);
NeoSyncApp = function(){
	//this.testNeo = new NeoSync({ watch : true, onFileRefresh : this.onFileRefresh.bind(this) });
	//Init pour obtenir les informations
	NeoSync.initConfiguration();
	NeoSyncApp.initConfiguration();
	
	this.currentPath = process.cwd() +  path.sep;
	this.dirElements = this.getDirElements();	

	//open('http://localhost:2802/');


	if (process.platform === "win32") {
		getWindowsDrives();
	}
}
NeoSyncApp.prototype.onFileRefresh = function(obj){
	//console.log( " onTestFileRefresh :" + obj.nFile.fileName );
	//this.socket.emit('refreshInformation', JSON.stringify( {lastFile : obj.nFile.fileName , currentPath: process.cwd()} ));
	this.historyFiles.push({date : (new Date()).getTime(), file : obj.nFile });
	this.sendInfo();
}
NeoSyncApp.prototype.onClientRequest = function(request, response){
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
NeoSyncApp.prototype.refreshInformations = function(){
	var obj = {};
	obj.currentPath = process.cwd();
	return obj;
} 
NeoSyncApp.prototype.historyFiles = new Array();
NeoSyncApp.prototype.neoSyncList = {};
NeoSyncApp.prototype.sendInfo = function(){
	//this.socket.emit('refreshInformation', 	this.getInfoAsString());
	if( typeof this.infoListener == "function")
		this.infoListener( this.getInfoAsString() );
};
NeoSyncApp.prototype.addInfoListener = function( fn ){
	this.infoListener = fn;
}
NeoSyncApp.prototype.changeDirectory = function( newDirectory ){
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
NeoSyncApp.prototype.addWatcher = function( directory ){
	var key = "NEOSYNC_" + (new Date()).getTime();
	if(!directory.match("\\" + path.sep + "$"))
		directory += path.sep;
	this.neoSyncList[key] = new NeoSync({ directory : directory, watch : true, onFileRefresh : this.onFileRefresh.bind(this)});
	this.sendInfo();
};
NeoSyncApp.prototype.removeWatcher = function( directory ){
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
NeoSyncApp.prototype.pushFile = function( fetch ){
	var pushNS = new NeoSync({ push : this.currentPath + fetch, onFileRefresh : this.onFileRefresh.bind(this) });
	this.sendInfo();
};
NeoSyncApp.prototype.fetchFile = function( fetch ){
	//var fetch = NeoSync.getFetchFromFile( this.currentPath + file );
	//On met tout en pause le temps du fetch
	this.pauseAllWatch();
	console.log("ON VA FETCHER" + fetch);	
	//On fetch et une fois fini, on relance tout
	var fetchNS = new NeoSync({ fetch : this.currentPath + fetch, onFetchDone : this.onFetchDone.bind(this) });
	//this.sendInfo();
};
NeoSyncApp.prototype.onFetchDone = function(){
	this.playAllWatch();
	this.dirElements = this.getDirElements();	
	this.sendInfo();
}
NeoSyncApp.prototype.getInfoAsString = function(){
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
			configFiles : NeoSyncApp.configFiles
		} );
};
NeoSyncApp.prototype.getNeoSyncList = function(){
	var neoSyncList = new Array();
	for(var i in this.neoSyncList)
		neoSyncList.push({key:i, path:this.neoSyncList[i].directory});
	return neoSyncList;
};
NeoSyncApp.prototype.pauseAllWatch = function(){
	for(var i in this.neoSyncList)
		this.neoSyncList[i].pauseWatch();	
};
NeoSyncApp.prototype.playAllWatch = function(){
	setTimeout(function(){
	console.log("On relance tout");
	for(var i in this.neoSyncList)
		this.neoSyncList[i].playWatch();
		}.bind(this),500);
};
NeoSyncApp.prototype.openFolder = function( folder ){
	var extensionReg = /\.([^\.]*)$/;
	var ext = "";
	if( folder.match(extensionReg) )
		ext = folder.match(extensionReg)[1];
	console.log('EXT : ' + ext);
	console.log('NeoSyncServer.config.filesEditor : ' + NeoSyncApp.config.filesEditor);
	if( NeoSyncApp.config.filesEditor && NeoSyncApp.config.filesEditor[ext])
		open( folder, NeoSyncApp.config.filesEditor[ext] );
	else
		open( folder );
}
NeoSyncApp.prototype.getDirElements = function(){
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
NeoSyncApp.config = {};
NeoSyncApp.initConfiguration = function(){
	var initFile = getUserHome() + path.sep + 'NeoSync' + path.sep + 'neoSyncServer.conf';
	//console.log( initFile );
	try{
		var configLines = fs.readFileSync( initFile );		
		NeoSyncApp.config = JSON.parse( configLines );
		}
	catch( err ){
		console.log( "NeoSyncApp : pas de fichier de configuration " + err);		
	}
	
}

function getUserHome() {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}
var nsApp = new NeoSyncApp();
NeoSyncApp.configFiles = NeoSync.getConfigurations();

exports.NeoSyncApp = nsApp;

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