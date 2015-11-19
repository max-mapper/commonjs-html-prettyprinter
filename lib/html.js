"use strict";

/*

Style HTML
---------------

Written by Nochum Sossonko, (nsossonko@hotmail.com)

Based on code initially developed by: Einar Lielmanis, <elfz@laacz.lv>
  http://jsbeautifier.org/


You are free to use this in any way you want, in case you find this useful or working for you.

Usage:
  style_html(html_source);

  style_html(html_source, options);

The options are:
  indent_size (default 4)                — indentation size,
  indent_char (default space)            — character to indent with,
  max_char (default 70)                  -  maximum amount of characters per line,
  brace_style (default "collapse")       - "collapse" | "expand" | "end-expand"
      put braces on the same line as control statements (default), or put braces on own line (Allman / ANSI style),
      or just put end braces on own line.
  unformatted (defaults to inline tags)  - list of tags, that shouldn't be reformatted
  indent_scripts (default normal)        - "keep"|"separate"|"normal"

  e.g.

    style_html(html_source, {
      'indent_size': 2,
      'indent_char': ' ',
      'max_char': 78,
      'brace_style': 'expand',
      'unformatted': ['a', 'sub', 'sup', 'b', 'i', 'u']
    });
*/

var Parser = require('./parser');

function style_html(html_source, options) {
  var script_indent_level;

  options = getOptions(options);
  var indent_scripts = options.indent_scripts;
  var indent_size = options.indent_size;
  var indent_character = options.indent_char;
  var brace_style = options.brace_style;
  var max_char = options.max_char;
  var unformatted = options.unformatted;

  var multi_parser = new Parser();
  multi_parser.printer(html_source, indent_character, indent_size, max_char, brace_style, unformatted);

  while (true) {
    var t = multi_parser.get_token();
    multi_parser.token_text = t[0];
    multi_parser.token_type = t[1];

    if (multi_parser.token_type === Parser.TOKEN_TYPE_EOF) {
      break;
    }

    switch (multi_parser.token_type) {
      case Parser.TOKEN_TYPE_TAG_NAME_START:
        multi_parser.print_newline(false, multi_parser.output);
        multi_parser.print_token(multi_parser.token_text);
        multi_parser.indent();
        multi_parser.current_mode = Parser.MODE_CONTENT;
        break;

      case Parser.TOKEN_TYPE_TAG_NAME_STYLE:
      case Parser.TOKEN_TYPE_TAG_NAME_SCRIPT:
        multi_parser.print_newline(false, multi_parser.output);
        multi_parser.print_token(multi_parser.token_text);
        multi_parser.current_mode = Parser.MODE_CONTENT;
        break;

      case Parser.TOKEN_TYPE_TAG_NAME_END:
        //Print new line only if the tag has no content and has child
        if (multi_parser.last_token === Parser.TOKEN_TYPE_CONTENT && multi_parser.last_text === '') {
          var tag_name = multi_parser.token_text.match(/\w+/)[0];
          var tag_extracted_from_last_output = multi_parser.output[multi_parser.output.length - 1].match(/<\s*(\w+)/);
          if (tag_extracted_from_last_output === null || tag_extracted_from_last_output[1] !== tag_name) {
            multi_parser.print_newline(true, multi_parser.output);
          }
        }
        multi_parser.print_token(multi_parser.token_text);
        multi_parser.current_mode = Parser.MODE_CONTENT;
        break;

      case Parser.TOKEN_TYPE_TAG_NAME_SINGLE:
        // Don't add a newline before elements that should remain unformatted.
        var tag_check = multi_parser.token_text.match(/^\s*<([a-z]+)/i);
        if (!tag_check || !multi_parser.Utils.in_array(tag_check[1], unformatted)) {
          multi_parser.print_newline(false, multi_parser.output);
        }
        multi_parser.print_token(multi_parser.token_text);
        multi_parser.current_mode = Parser.MODE_CONTENT;
        break;

      case Parser.TOKEN_TYPE_CONTENT:
        if (multi_parser.token_text !== '') {
          multi_parser.print_token(multi_parser.token_text);
        }
        multi_parser.current_mode = Parser.MODE_TAG;
        break;

      case Parser.TOKEN_TYPE_STYLE:
      case Parser.TOKEN_TYPE_SCRIPT:
        if (multi_parser.token_text !== '') {
          multi_parser.output.push('\n');
          var text = multi_parser.token_text;
          var _beautifier = null;
          if (multi_parser.token_type == Parser.TOKEN_TYPE_SCRIPT) {
            _beautifier = typeof js_beautify == 'function' && js_beautify;
          } else if (multi_parser.token_type == Parser.TOKEN_TYPE_STYLE) {
            _beautifier = typeof css_beautify == 'function' && css_beautify;
          }

          switch (indent_scripts) {
            case 'keep':
              script_indent_level = 0;
              break;

            case 'separate':
              script_indent_level = -multi_parser.indent_level;
              break;

            case 'normal':
            default:
              script_indent_level = 1;
          }

          var indentation = multi_parser.get_full_indent(script_indent_level);
          if (_beautifier) {
            // call the Beautifier if avaliable
            text = _beautifier(text.replace(/^\s*/, indentation), options);
          } else {
            // simply indent the string otherwise
            var white = text.match(/^\s*/)[0];
            var _level = white.match(/[^\n\r]*$/)[0].split(multi_parser.indent_string).length - 1;
            var reindent = multi_parser.get_full_indent(script_indent_level - _level);
            text = text.replace(/^\s*/, indentation)
              .replace(/\r\n|\r|\n/g, '\n' + reindent)
              .replace(/\s*$/, '');
          }
          if (text) {
            multi_parser.print_token(text);
            multi_parser.print_newline(true, multi_parser.output);
          }
        }
        multi_parser.current_mode = Parser.MODE_TAG;
        break;
    }

    multi_parser.last_token = multi_parser.token_type;
    multi_parser.last_text = multi_parser.token_text;
  }

  return multi_parser.output.join('');
}

function getOptions(options) {
  options = options || {};

  options.indent_scripts = options.indent_scripts || 'normal';
  options.indent_size = options.indent_size || 4;
  options.indent_character = options.indent_char || ' ';
  options.brace_style = options.brace_style || 'collapse';
  options.max_char = options.max_char == 0 ? Infinity : options.max_char || 70;
  options.unformatted = options.unformatted || ['a', 'span', 'bdo', 'em', 'strong', 'dfn', 'code', 'samp', 'kbd', 'var',
      'cite', 'abbr', 'acronym', 'q', 'sub', 'sup', 'tt', 'i', 'b', 'big', 'small', 'u', 's', 'strike', 'font', 'ins',
      'del', 'pre', 'address', 'dt', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

  return options;
}


module.exports = {
  Parser: Parser,
  prettyPrint: style_html,
  getOptions: getOptions
};
