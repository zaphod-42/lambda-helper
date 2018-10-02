#! /usr/bin/env node

var fs = require('fs');
var AWS = require('aws-sdk');
var http = require('https');
var child_process = require('child_process');
var lambda = new AWS.Lambda({apiVersion: '2015-03-31', region: 'us-east-1'});

var dir = process.cwd();
var dirname = dir.split('/').pop();

switch(process.argv[2]){
	case 'pull':
		fetchZipFile(dirname).then((temp) => {
			var oldtemp = `/tmp/${dirname}_old.zip`;
			child_process.exec(`zip -r ${oldtemp} ${dir}`, {}, (err, stdout, stderr) => {
				if(err){
					console.log(err);
				}else{
					process.chdir("..");
					child_process.exec(`rm -r ${dir}`, {}, (err, stdout, stderr) => {
						if(err) console.log(err);
						else{
							fs.mkdirSync(dirname);
							process.chdir(dir);
							child_process.exec(`unzip  ${temp}`, {}, (err, stdout, stderr) => {
								if(err){
									console.log(err);
								}else{
									fs.unlinkSync(oldtemp);
									fs.unlinkSync(temp);
								}
							});
						}
					});
				}
			});
		}).catch(console.log);
		break;
	case 'fetch':
		dirname = process.argv[3];
		fetchZipFile(dirname).then((temp) => {
			fs.mkdirSync(dirname);
			process.chdir(dirname);
			child_process.exec(`unzip  ${temp}`, {}, (err, stdout, stderr) => {
				if(err){
					console.log(err);
				}else{
					fs.unlinkSync(temp);
				}
			});
		});
		break;
	case 'push':
		var oldtemp = `/tmp/${dirname}_old.zip`;
		child_process.exec(`zip -r ${oldtemp} *`, {}, (err, stdout, stderr) => {
			if(err){
				console.log(err);
			}else{
				lambda.updateFunctionCode({
					FunctionName: dirname,
					ZipFile: fs.readFileSync(oldtemp)
				}, (err, data) => {
					if(err) console.log(err);
					fs.unlinkSync(oldtemp);
				});
			}
		});
		break;
}


function getFunctionDef(name){
	return new Promise((fulfill, reject) => {
		lambda.getFunction({FunctionName: name}, (err, data) => {
			if(err){
				reject(err);
			}else{
				fulfill(data);
			}
		});
	});
}

function fetchZipFile(name){
	return new Promise((fulfill, reject) => {
		getFunctionDef(name).then((data) => {
			var tmpname = '/tmp/lambda-pull-'+Date.now()+'.zip';
			var temp = fs.createWriteStream(tmpname);
			http.get(data.Code.Location, (r) => {
				r.pipe(temp);
				fulfill(tmpname);
			});
		}).catch(reject);
	});
}
