#!/usr/bin/env node

var sys = require("sys")
var html = require("../lib/html")
var fs = require('fs')
var glob = require('glob')

var args = process.argv.slice(0);
// shift off node and script name
args.shift()
args.shift()

if (args.length > 0) processFiles(args[0])
else readStdin()

function readStdin() {
  var stdin = process.openStdin()
  var data = ""

  stdin.setEncoding("utf8")

  stdin.on("data", function(chunk) {
    data += chunk
  })

  stdin.on("end", function() {
    process.stdout.write(html.prettyPrint(data, {indent_size: 2}))
  })
}

function processFiles(name) {
  if (name.match(/\*/)) {
    glob(name, function(err, files) {
      if (err) return console.log(err)
      files.map(function(filename) {
        prettifyFile(filename)
      })
    })
    return
  }
  var str = fs.readFileSync(name).toString()
  process.stdout.write(prettify(str))
}

function prettify(str) {
  return html.prettyPrint(str, {indent_size: 2})
}

function prettifyFile(filename) {
  fs.writeFileSync(filename, prettify(fs.readFileSync(filename).toString()))
}
