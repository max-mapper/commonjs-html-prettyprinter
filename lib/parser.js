function Parser() {

  this.pos = 0; //Parser position
  this.current_mode = Parser.MODE_CONTENT; //reflects the current Parser mode: TAG/CONTENT
  this.tags = { //An object to hold tags, their position, and their parent-tags, initiated with default values
    parent: 'parent1',
    parentcount: 1,
    parent1: ''
  };
  this.tag_type = '';
  this.token_text = this.last_token = this.last_text = this.token_type = '';

  return this;
}

Parser.prototype = {
  Utils: { //Utilities made available to the various functions
    whitespace: "\n\r\t ".split(''),
    single_token: 'br,input,link,meta,!doctype,basefont,base,area,hr,wbr,param,img,isindex,?xml,embed,?php,?,?='.split(','), //all the single tags for HTML
    extra_liners: 'head,body,/html'.split(','), //for tags that need a line of whitespace before them
    in_array: function(what, arr) {
      return arr.indexOf(what) !== -1;
    }
  },

  get_content: function() { //function to capture regular content between tags
    var input_char = '',
      content = [],
      space = false; //if a space is needed

    while (this.input.charAt(this.pos) !== '<') {
      if (this.pos >= this.input.length) {
        return content.length ? content.join('') : ['', Parser.TOKEN_TYPE_EOF];
      }

      input_char = this.input.charAt(this.pos);
      this.pos++;
      this.line_char_count++;

      if (this.Utils.in_array(input_char, this.Utils.whitespace)) {
        if (content.length) {
          space = true;
        }
        this.line_char_count--;
        continue; //don't want to insert unnecessary space
      }
      else if (space) {
        if (this.line_char_count >= this.max_char) { //insert a line when the max_char is reached
          content.push('\n');
          for (var i = 0; i < this.indent_level; i++) {
            content.push(this.indent_string);
          }
          this.line_char_count = 0;
        }
        else {
          content.push(' ');
          this.line_char_count++;
        }
        space = false;
      }
      content.push(input_char); //letter at-a-time (or string) inserted to an array
    }
    return content.length ? content.join('') : '';
  },

  get_contents_to: function(name) { //get the full content of a script or style to pass to js_beautify
    if (this.pos == this.input.length) {
      return ['', Parser.TOKEN_TYPE_EOF];
    }
    var content = '';
    var reg_match = new RegExp('\<\/' + name + '\\s*\>', 'igm');
    reg_match.lastIndex = this.pos;
    var reg_array = reg_match.exec(this.input);
    var end_script = reg_array ? reg_array.index : this.input.length; //absolute end of script
    if (this.pos < end_script) { //get everything in between the script tags
      content = this.input.substring(this.pos, end_script);
      this.pos = end_script;
    }
    return content;
  },

  record_tag: function(tag) { //function to record a tag and its parent in this.tags Object
    var tag_count = tag + 'count';
    if (this.tags[tag_count]) { //check for the existence of this tag type
      this.tags[tag_count]++;
      this.tags[tag + this.tags[tag_count]] = this.indent_level; //and record the present indent level
    }
    else { //otherwise initialize this tag type
      this.tags[tag_count] = 1;
      this.tags[tag + this.tags[tag_count]] = this.indent_level; //and record the present indent level
    }
    this.tags[tag + this.tags[tag_count] + 'parent'] = this.tags.parent; //set the parent (i.e. in the case of a div this.tags.div1parent)
    this.tags.parent = tag + this.tags[tag_count]; //and make this the current parent (i.e. in the case of a div 'div1')
  },

  retrieve_tag: function(tag) { //function to retrieve the opening tag to the corresponding closer
    var tag_count = tag + 'count';
    if (this.tags[tag_count]) { //if the openener is not in the Object we ignore it
      var temp_parent = this.tags.parent; //check to see if it's a closable tag.
      while (temp_parent) { //till we reach '' (the initial value);
        if (tag + this.tags[tag_count] === temp_parent) { //if this is it use it
          break;
        }
        temp_parent = this.tags[temp_parent + 'parent']; //otherwise keep on climbing up the DOM Tree
      }
      if (temp_parent) { //if we caught something
        this.indent_level = this.tags[tag + this.tags[tag_count]]; //set the indent_level accordingly
        this.tags.parent = this.tags[temp_parent + 'parent']; //and set the current parent
      }
      delete this.tags[tag + this.tags[tag_count] + 'parent']; //delete the closed tags parent reference...
      delete this.tags[tag + this.tags[tag_count]]; //...and the tag itself
      if (this.tags[tag_count] == 1) {
        delete this.tags[tag_count];
      }
      else {
        this.tags[tag_count]--;
      }
    }
  },

  get_tag: function() { //function to get a full tag and parse its type
    var input_char = '',
      content = [],
      space = false,
      tag_start, tag_end;

    do {
      if (this.pos >= this.input.length) {
        return content.length ? content.join('') : ['', Parser.TOKEN_TYPE_EOF];
      }

      input_char = this.input.charAt(this.pos);
      this.pos++;
      this.line_char_count++;

      if (this.Utils.in_array(input_char, this.Utils.whitespace)) { //don't want to insert unnecessary space
        space = true;
        this.line_char_count--;
        continue;
      }

      if (input_char === "'" || input_char === '"') {
        if (!content[1] || content[1] !== '!') { //if we're in a comment strings don't get treated specially
          input_char += this.get_unformatted(input_char);
          space = true;
        }
      }

      if (input_char === '=') { //no space before =
        space = false;
      }

      if (content.length && content[content.length - 1] !== '=' && input_char !== '>'
        && space) { //no space after = or before >
        if (this.line_char_count >= this.max_char) {
          this.print_newline(false, content);
          this.line_char_count = 0;
        }
        else {
          content.push(' ');
          this.line_char_count++;
        }
        space = false;
      }
      if (input_char === '<') {
        tag_start = this.pos - 1;
      }
      content.push(input_char); //inserts character at-a-time (or string)
    }
    while (input_char !== '>');

    var tag_complete = content.join('');
    var tag_index;
    var comment;
    if (tag_complete.indexOf(' ') != -1) { //if there's whitespace, thats where the tag name ends
      tag_index = tag_complete.indexOf(' ');
    }
    else { //otherwise go with the tag ending
      tag_index = tag_complete.indexOf('>');
    }
    var tag_check = tag_complete.substring(1, tag_index).toLowerCase();
    if (tag_complete.charAt(tag_complete.length - 2) === '/' ||
      this.Utils.in_array(tag_check, this.Utils.single_token)) { //if this tag name is a single tag type (either in the list or has a closing /)
      this.tag_type = Parser.TOKEN_TYPE_TAG_SINGLE;
    }
    else if (tag_check === 'script') { //for later script handling
      this.record_tag(tag_check);
      this.tag_type = Parser.TOKEN_TYPE_TAG_SCRIPT;
    }
    else if (tag_check === 'style') { //for future style handling (for now it justs uses get_content)
      this.record_tag(tag_check);
      this.tag_type = Parser.TOKEN_TYPE_TAG_STYLE;
    }
    else if (this.Utils.in_array(tag_check, this.unformatted)) { // do not reformat the "unformatted" tags
      comment = this.get_unformatted('</' + tag_check + '>', tag_complete); //...delegate to get_unformatted function
      content.push(comment);
      // Preserve collapsed whitespace either before or after this tag.
      if (tag_start > 0 && this.Utils.in_array(this.input.charAt(tag_start - 1), this.Utils.whitespace)) {
        content.splice(0, 0, this.input.charAt(tag_start - 1));
      }
      tag_end = this.pos - 1;
      if (this.Utils.in_array(this.input.charAt(tag_end + 1), this.Utils.whitespace)) {
        content.push(this.input.charAt(tag_end + 1));
      }
      this.tag_type = Parser.TOKEN_TYPE_TAG_SINGLE;
    }
    else if (tag_check.charAt(0) === '!') { //peek for <!-- comment
      if (tag_check.indexOf('[if') != -1) { //peek for <!--[if conditional comment
        if (tag_complete.indexOf('!IE') != -1) { //this type needs a closing --> so...
          comment = this.get_unformatted('-->', tag_complete); //...delegate to get_unformatted
          content.push(comment);
        }
        this.tag_type = Parser.TOKEN_TYPE_TAG_START;
      }
      else if (tag_check.indexOf('[endif') != -1) {//peek for <!--[endif end conditional comment
        this.tag_type = Parser.TOKEN_TYPE_TAG_END;
        this.unindent();
      }
      else if (tag_check.indexOf('[cdata[') != -1) { //if it's a <[cdata[ comment...
        comment = this.get_unformatted(']]>', tag_complete); //...delegate to get_unformatted function
        content.push(comment);
        this.tag_type = Parser.TOKEN_TYPE_TAG_SINGLE; //<![CDATA[ comments are treated like single tags
      }
      else {
        comment = this.get_unformatted('-->', tag_complete);
        content.push(comment);
        this.tag_type = Parser.TOKEN_TYPE_TAG_SINGLE;
      }
    }
    else {
      if (tag_check.charAt(0) === '/') { //this tag is a double tag so check for tag-ending
        this.retrieve_tag(tag_check.substring(1)); //remove it and all ancestors
        this.tag_type = Parser.TOKEN_TYPE_TAG_END;
      }
      else { //otherwise it's a start-tag
        this.record_tag(tag_check); //push it on the tag stack
        this.tag_type = Parser.TOKEN_TYPE_TAG_START;
      }
      if (this.Utils.in_array(tag_check, this.Utils.extra_liners)) { //check if this double needs an extra line
        this.print_newline(true, this.output);
      }
    }
    return content.join(''); //returns fully formatted tag
  },

  get_unformatted: function(delimiter, orig_tag) { //function to return unformatted content in its entirety

    if (orig_tag && orig_tag.toLowerCase().indexOf(delimiter) != -1) {
      return '';
    }
    var input_char = '';
    var content = '';
    var space = true;
    do {

      if (this.pos >= this.input.length) {
        return content;
      }

      input_char = this.input.charAt(this.pos);
      this.pos++;

      if (this.Utils.in_array(input_char, this.Utils.whitespace)) {
        if (!space) {
          this.line_char_count--;
          continue;
        }
        if (input_char === '\n' || input_char === '\r') {
          content += '\n';
          /*  Don't change tab indention for unformatted blocks.  If using code for html editing, this will greatly affect <pre> tags if they are specified in the 'unformatted array'
           for (var i=0; i<this.indent_level; i++) {
           content += this.indent_string;
           }
           space = false; //...and make sure other indentation is erased
           */
          this.line_char_count = 0;
          continue;
        }
      }
      content += input_char;
      this.line_char_count++;
      space = true;


    }
    while (content.toLowerCase().indexOf(delimiter) == -1);
    return content;
  },

  get_token: function() { //initial handler for token-retrieval
    var token;

    if (this.last_token === Parser.TOKEN_TYPE_TAG_SCRIPT || this.last_token === Parser.TOKEN_TYPE_TAG_STYLE) { //check if we need to format javascript
      var type = this.last_token.substr(7);
      token = this.get_contents_to(type);
      if (typeof token !== 'string') {
        return token;
      }
      return [token, this.get_tag_name_type(type)];
    }
    if (this.current_mode === Parser.MODE_CONTENT) {
      token = this.get_content();
      if (typeof token !== 'string') {
        return token;
      }
      else {
        return [token, Parser.TOKEN_TYPE_CONTENT];
      }
    }

    if (this.current_mode === Parser.MODE_TAG) {
      token = this.get_tag();
      if (typeof token !== 'string') {
        return token;
      }
      else {
        return [token, this.get_tag_name_type(this.tag_type)];
      }
    }
  },

  get_tag_name_type: function(tag_type) {
    switch (tag_type) {
      case Parser.TOKEN_TYPE_TAG_SINGLE:
        return Parser.TOKEN_TYPE_TAG_NAME_SINGLE;
      case Parser.TOKEN_TYPE_TAG_STYLE:
        return Parser.TOKEN_TYPE_TAG_NAME_STYLE;
      case Parser.TOKEN_TYPE_TAG_SCRIPT:
        return Parser.TOKEN_TYPE_TAG_NAME_SCRIPT;
      case Parser.TOKEN_TYPE_TAG_START:
        return Parser.TOKEN_TYPE_TAG_NAME_START;
      case Parser.TOKEN_TYPE_TAG_END:
        return Parser.TOKEN_TYPE_TAG_NAME_END;
    }
  },

  get_full_indent: function(level) {
    level = this.indent_level + level || 0;
    if (level < 1) {
      return '';
    }

    return new Array(level + 1).join(this.indent_string);
  },

  printer: function(js_source, indent_character, indent_size, max_char, brace_style, unformatted) { //handles input/output and some other printing functions

    this.input = js_source || ''; //gets the input for the Parser
    this.output = [];
    this.indent_character = indent_character;
    this.indent_string = '';
    this.indent_size = indent_size;
    this.brace_style = brace_style;
    this.indent_level = 0;
    this.max_char = max_char;
    this.line_char_count = 0; //count to see if max_char was exceeded
    this.unformatted = unformatted;

    for (var i = 0; i < this.indent_size; i++) {
      this.indent_string += this.indent_character;
    }

  },

  print_newline: function(ignore, arr) {
    this.line_char_count = 0;
    if (!arr || !arr.length) {
      return;
    }
    if (!ignore) { //we might want the extra line
      while (this.Utils.in_array(arr[arr.length - 1], this.Utils.whitespace)) {
        arr.pop();
      }
    }
    arr.push('\n');
    for (var i = 0; i < this.indent_level; i++) {
      arr.push(this.indent_string);
    }
  },

  print_token: function(text) {
    this.output.push(text);
  },

  indent: function() {
    this.indent_level++;
  },

  unindent: function() {
    if (this.indent_level > 0) {
      this.indent_level--;
    }
  }
};

Parser.TOKEN_TYPE_TAG_SINGLE = 'SINGLE';
Parser.TOKEN_TYPE_TAG_STYLE = 'STYLE';
Parser.TOKEN_TYPE_TAG_SCRIPT = 'SCRIPT';
Parser.TOKEN_TYPE_TAG_START = 'START';
Parser.TOKEN_TYPE_TAG_END = 'END';

Parser.TOKEN_TYPE_TAG_NAME_SINGLE = 'TK_TAG_SINGLE';
Parser.TOKEN_TYPE_TAG_NAME_STYLE = 'TK_TAG_STYLE';
Parser.TOKEN_TYPE_TAG_NAME_SCRIPT = 'TK_TAG_SCRIPT';
Parser.TOKEN_TYPE_TAG_NAME_START = 'TK_TAG_START';
Parser.TOKEN_TYPE_TAG_NAME_END = 'TK_TAG_END';

Parser.TOKEN_TYPE_EOF = 'TK_EOF';
Parser.TOKEN_TYPE_CONTENT = 'TK_CONTENT';
Parser.TOKEN_TYPE_STYLE = 'TK_STYLE';
Parser.TOKEN_TYPE_SCRIPT = 'TK_SCRIPT';

Parser.MODE_CONTENT = 'CONTENT';
Parser.MODE_TAG = 'TAG';

module.exports = Parser;
