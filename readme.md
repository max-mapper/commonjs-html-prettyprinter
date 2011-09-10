# commonjs html prettyprinter

A commonjs port of beautify-html.js by Nochum Sossonko which is based on jsbeautifier by Einar Lielmanis

## Installation

### from npm (node package manager)
``` bash
  npm install html
```

## Usage (command line)

```
  echo "<h2><strong><a href="http://awesome.com">AwesomeCom</a></strong><span>is awesome</span></h2>" | html
```

returns:
  
``` html  
  <h2>
      <strong>
          <a href=http://awesome.com>AwesomeCom</a>
      </strong>
      <span>
          is awesome
      </span>
  </h2>
````