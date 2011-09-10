#!/usr/bin/env node

var sys = require("sys"),
    html = require("../lib/html");

var args = process.argv.slice(0);

// shift off node and script name
args.shift(); args.shift();

var stdin = process.openStdin()
  , data = ""
  ;
  
stdin.setEncoding("utf8");

stdin.on("data", function(chunk) {
  data += chunk;
});

stdin.on("end", function() {
  process.stdout.write(html.prettyPrint(data))
});
