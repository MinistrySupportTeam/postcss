var Root  = require('../lib/root');
var parse = require('../lib/parse');

var fs   = require('fs');
var path = require('path');

var read = file => fs.readFileSync(__dirname + '/cases/parse/' + file);

describe('postcss.parse()', () => {

    it('works with file reads', () => {
        var css = fs.readFileSync(__dirname + '/cases/parse/atrule-empty.css');
        parse(css).should.be.instanceOf(Root);
    });

    describe('empty file', () => {

        it('parses UTF-8 BOM', () => {
            parse('\uFEFF@host { a {\f} }');
        });

        it('parses empty file', () => {
            parse('').should.eql({ type: 'root', rules: [], after: '' });
        });

        it('parses spaces', () => {
            parse(" \n").should.eql({ type: 'root', rules: [], after: " \n" });
        });

    });

    fs.readdirSync(__dirname + '/cases/parse/').forEach( (file) => {
        if ( !file.match(/\.css$/) ) return;

        it('parses ' + file, () => {
            var css  = parse(read(file));
            var json = read(file.replace(/\.css$/, '.json')).toString().trim();
            JSON.stringify(css, null, 4).should.eql(json);
        });
    });

    it('saves source file', () => {
        var css = parse('a {}', { from: 'a.css' });
        css.rules[0].source.file.should.eql(path.resolve('a.css'));
    });

    it('sets parent node', () => {
        var css = parse(read('atrule-rules.css'));

        var support   = css.rules[0];
        var keyframes = support.rules[0];
        var from      = keyframes.rules[0];
        var decl      = from.decls[0];

        decl.parent.should.exactly(from);
        from.parent.should.exactly(keyframes);
        keyframes.parent.should.exactly(support);
        support.parent.should.exactly(css);
    });

    describe('errors', () => {

        it('fixes unclosed blocks', () => {
            parse('@media (screen) { a {\n')
                .toString().should.eql('@media (screen) { a {\n}}');

            parse('a { color')
                .first.first.prop.should.eql('color');
        });

        it('throws on unclosed blocks in strict mode', () => {
            ( () => parse('\na {\n', { strict: true }) ).should
                .throw(/Unclosed block at line 2:1/);
        });

        it('fixes unnecessary block close', () => {
            var root = parse('a {\n} }');
            root.first.toString().should.eql('a {\n}');
            root.after.should.eql(' }');
        });

        it('throws on unnecessary block close', () => {
            ( () => parse('a {\n} }', { strict: true }) ).should
                .throw(/Unexpected } at line 2:3/);
        });

        it('fixes unclosed comment', () => {
            var root = parse('a { /* b ');
            root.toString().should.eql('a { /* b */}');
            root.first.first.text.should.eql('b');
        });

        it('throws on unclosed comment in strict mode', () => {
            ( () => parse('\n/*\n\n ', { strict: true }) ).should
                .throw(/Unclosed comment at line 2:1/);
        });

        it('fixes unclosed quote', () => {
            parse('a { content: "b').
                toString().should.eql('a { content: "b}');
        });

        it('throws on unclosed quote in strict mode', () => {
            ( () => parse('\n"\n\na ', { strict: true }) ).should
                .throw(/Unclosed quote at line 2:1/);
        });

        it('fixes property without value', () => {
            var root = parse('a { color: white; one }');
            root.first.decls.length.should.eql(1);
            root.first.semicolon.should.be.true;
            root.first.after.should.eql(' one ');
        });

        it('throws on property without value in strict mode', () => {
            ( () => parse("a { b;}", { strict: true }) ).should
                .throw(/Missing property value/);
            ( () => parse("a { b }", { strict: true }) ).should
                .throw(/Missing property value/);
        });

        it('throws on nameless at-rule', () => {
            ( () => parse('@') ).should.throw(/At-rule without name/);
        });

        it('throws on block inside declarations', () => {
            ( () => parse("a {{}}") ).should.throw(/Unexpected \{/);
        });

        it('throw on rules in declarations at-rule', () => {
            ( () => parse('@page { a { } }') ).should.throw(/Unexpected \{/);
        });

        it('adds properties to error', () => {
            var error;
            try {
                parse('a {', { strict: true });
            } catch (e) {
                error = e;
            }

            error.line.should.eql(1);
            error.column.should.eql(1);
            error.source.should.eql('a {');
        });

    });

});
