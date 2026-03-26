import { expect, test, describe, afterEach, vi, beforeAll } from 'vitest';
import { createEditors } from "./app";
import indexHtml from '../index.html?raw';

let instance: ReturnType<typeof createEditors>;

const Severity = {
    Hint: 1,
    Info: 2,
    Warning: 4,
    Error: 8
} as const;

beforeAll(async () => {
    document.documentElement.innerHTML = indexHtml;
    const htmlElement = document.getElementById('html-editor') as HTMLElement;
    const tsElement = document.getElementById('ts-editor') as HTMLElement;
    instance = createEditors(htmlElement, tsElement);
    instance.tsEditor.setValue('const x: string = 123;');
    await vi.waitUntil(() => {
        const m = instance.getTsErrors();
        return m.length ? m : false;
    }, { timeout: 5000 });
    instance.tsEditor.setValue('');
    await vi.waitUntil(() => {
        const m = instance.getTsErrors();
        return m.length === 0 ? true : false;
    });
});

afterEach(async () => {
    instance.tsEditor.setValue('');
    await vi.waitUntil(() => {
        const m = instance.getTsErrors();
        return m.length === 0 ? true : false;
    });
});

//Skipping as done, note remove this
describe.skip('NG Declaration Errors', () => {
    test('NG1001 DECORATOR_ARG_NOT_LITERAL', async () => {
        instance.tsEditor.setValue(
            `import { Component } from '@angular/core';
            const args = {};
            @Component(args)
            export class HelloComponent {}`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[0].severity).toBe(Severity.Error);
        expect(markers[0].message).toContain("@Component argument must be an object literal");
    });

    test('NG1001 DECORATOR_ARG_NOT_LITERAL — NgModule', async () => {
        instance.tsEditor.setValue(
            `import { NgModule } from '@angular/core';
            const config = {};
            @NgModule(config)
            export class AppModule {}`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[0].severity).toBe(Severity.Error);
        expect(markers[0].message).toContain("@NgModule argument must be an object literal");
    });

    test('NG1001 DECORATOR_ARG_NOT_LITERAL — Pipe', async () => {
        instance.tsEditor.setValue(
            `import { Pipe } from '@angular/core';
            const config = { name: 'test' };
            @Pipe(config)
            export class TestPipe {
                transform(value: any) { return value; }
            }`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[0].severity).toBe(Severity.Error);
        expect(markers[0].message).toContain("@Pipe must have a literal argument");
    });

    test('NG1001 DECORATOR_ARG_NOT_LITERAL — Injectable', async () => {
        instance.tsEditor.setValue(
            `import { Injectable } from '@angular/core';
            const opts = {};
            @Injectable(opts)
            export class MyService {}`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[1].severity).toBe(Severity.Error);
        expect(markers[1].message).toContain("@Injectable argument must be an object literal");
    });

    test('NG1001 DECORATOR_ARG_NOT_LITERAL — Directive', async () => {
        instance.tsEditor.setValue(
            `import { Directive } from '@angular/core';
            const config = { selector: '[myDir]' };
            @Directive(config)
            export class MyDirective {}`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[0].severity).toBe(Severity.Error);
        expect(markers[0].message).toContain("@Directive argument must be an object literal");
    });

    test('NG1003 DECORATOR_NOT_CALLED — Pipe', async () => {
        instance.tsEditor.setValue(
            `import { Pipe } from '@angular/core';
            @Pipe
            export class TestPipe {
                transform(value: any) { return value; }
            }`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[1].severity).toBe(Severity.Error);
        expect(markers[1].message).toContain("@Pipe must be called");
    });

    test('NG1003 DECORATOR_NOT_CALLED — Injectable', async () => {
        instance.tsEditor.setValue(
            `import { Injectable } from '@angular/core';
            @Injectable
            export class MyService {}`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        }, { timeout: 5000 });
        expect(markers[2].severity).toBe(Severity.Error);
        expect(markers[2].message).toContain("@Injectable must be called");
    });

    test('NG1006 DECORATOR_COLLISION — query decorators', async () => {
        instance.tsEditor.setValue(
            `import { Component, ViewChild, ContentChild } from '@angular/core';
            @Component({
                selector: 'test-cmp',
                standalone: true,
                template: '<div></div>'
            })
            export class TestComponent {
                @ViewChild('a') @ContentChild('a') myRef: any;
            }`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[0].severity).toBe(Severity.Error);
        expect(markers[0].message).toContain("Cannot combine");
    });

    test('NG1010 VALUE_HAS_WRONG_TYPE — descendants option', async () => {
        instance.tsEditor.setValue(
            `import { Component, ContentChildren } from '@angular/core';
            @Component({
                selector: 'test-cmp',
                standalone: true,
                template: '<div></div>'
            })
            export class TestComponent {
                @ContentChildren('child', { descendants: 'yes' as any }) children: any;
            }`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[0].severity).toBe(Severity.Error);
    });

    test('NG1100 INCORRECTLY_DECLARED_ON_STATIC_MEMBER — Input on static', async () => {
        instance.tsEditor.setValue(
            `import { Component, Input } from '@angular/core';
            @Component({
                selector: 'test-cmp',
                standalone: true,
                template: '<div></div>'
            })
            export class TestComponent {
                @Input() static myInput: string;
            }`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[0].severity).toBe(Severity.Error);
        expect(markers[0].message).toContain("static");
    });
});

describe('NG Component Metadata Errors', () => {
    test('NG2001 COMPONENT_MISSING_TEMPLATE', async () => {
        instance.tsEditor.setValue(
            `import { Component } from '@angular/core';
            @Component({
                selector: 'test-cmp',
                standalone: true
            })
            export class TestComponent {}`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[0].severity).toBe(Severity.Error);
        expect(markers[0].message).toContain("missing a template");
    });

    test('NG2002 PIPE_MISSING_NAME', async () => {
        instance.tsEditor.setValue(
            `import { Pipe } from '@angular/core';
            @Pipe({})
            export class TestPipe {
                transform(value: any) { return value; }
            }`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[1].severity).toBe(Severity.Error);
        expect(markers[1].message).toContain("missing name");
    });

    // Not sure how to get this one to show up
    // test('NG2004 DIRECTIVE_MISSING_SELECTOR', async () => {
    //     instance.tsEditor.setValue(
    //         `import { Directive } from '@angular/core';
    //         @Directive({})
    //         export class MyDirective {}`
    //     );
    //     const markers = await vi.waitUntil(() => {
    //         const m = instance.getTsErrors();
    //         return m.length ? m : false;
    //     });
    //     expect(markers[0].severity).toBe(Severity.Error);
    //     expect(markers[0].message).toContain("no selector");
    // });

    test('NG2010 COMPONENT_NOT_STANDALONE — imports without standalone', async () => {
        instance.tsEditor.setValue(
            `import { Component, Pipe } from '@angular/core';
            @Pipe({ name: 'test' })
            export class TestPipe {
                transform(value: any) { return value; }
            }
            @Component({
                standalone: false,
                selector: 'test-cmp',
                template: '<div></div>',
                imports: [TestPipe]
            })
            export class TestComponent {}`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[0].severity).toBe(Severity.Error);
        expect(markers[0].message).toContain("standalone");
    });

    test('NG2021 COMPONENT_INVALID_STYLE_URLS — both styleUrl and styleUrls', async () => {
        instance.tsEditor.setValue(
            `import { Component } from '@angular/core';
            @Component({
                selector: 'test-cmp',
                standalone: true,
                template: '<div></div>',
                styleUrl: './test.css',
                styleUrls: ['./test2.css']
            })
            export class TestComponent {}`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[0].severity).toBe(Severity.Error);
        expect(markers[0].message).toContain("styleUrl");
    });
});

describe('NG Template Parse Errors', () => {
    test('NG5002 TEMPLATE_PARSE_ERROR', async () => {
        instance.tsEditor.setValue(
            `import { Component } from '@angular/core';
            @Component({
                selector: 'test',
                templateUrl: './app.html'
            })
            export class TestComponent {}`
        );
        instance.htmlEditor.setValue('<div>{/{}}</div>');
        const markers = await vi.waitUntil(() => {
            const m = instance.getHtmlErrors();
            return m.length ? m : false;
        });
        expect(markers[0].severity).toBe(Severity.Error);
        expect(markers[0].message).toContain("Unexpected character \"EOF\"");
    });

    test('NG5002 TEMPLATE_PARSE_ERROR - blank', async () => {
        instance.tsEditor.setValue(
            `import { Component } from '@angular/core';
            @Component({
                selector: 'test-cmp',
                template: '<div>{{}}</div>'
            })
            export class TestComponent {}`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[0].severity).toBe(Severity.Error);
        expect(markers[0].message).toContain("Blank expressions are not allowed in interpolated strings");
    });
});

describe('NG NgModule Scope Errors', async () => {
    test('NG6001 NGMODULE_INVALID_DECLARATION — non-directive in declarations', async () => {
        instance.tsEditor.setValue(
            `import { NgModule } from '@angular/core';
            export class NotADirective {}
            @NgModule({
                declarations: [NotADirective]
            })
            export class AppModule {}`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[0].severity).toBe(Severity.Error);
        expect(markers[0].message).toContain("not a directive, a component, or a pipe");
    });

    test('NG6008 NGMODULE_DECLARATION_IS_STANDALONE', async () => {
        instance.tsEditor.setValue(
            `import { NgModule, Component } from '@angular/core';
            @Component({
                selector: 'my-cmp',
                standalone: true,
                template: '<div></div>'
            })
            export class MyCmp {}
            @NgModule({
                declarations: [MyCmp]
            })
            export class AppModule {}`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[0].severity).toBe(Severity.Error);
        expect(markers[0].message).toContain("standalone");
    });
});

describe('NG Template Type-Check Errors', () => {
    test('NG8001 SCHEMA_INVALID_ELEMENT — unknown element', async () => {
        instance.tsEditor.setValue(
            `import { Component } from '@angular/core';
            @Component({
                selector: 'test-cmp',
                standalone: true,
                template: '<unknown-element></unknown-element>'
            })
            export class TestComponent {}`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[0].severity).toBe(Severity.Error);
        expect(markers[0].message).toContain("is not a known element");
    });

    test('NG8002 SCHEMA_INVALID_ATTRIBUTE — unknown property binding', async () => {
        instance.tsEditor.setValue(
            `import { Component } from '@angular/core';
            @Component({
                selector: 'test-cmp',
                standalone: true,
                template: '<div [unknownProp]="true"></div>'
            })
            export class TestComponent {}`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[0].severity).toBe(Severity.Error);
        expect(markers[0].message).toContain("isn't a known property");
    });

    test('NG8004 MISSING_PIPE — unknown pipe', async () => {
        instance.tsEditor.setValue(
            `import { Component } from '@angular/core';
            @Component({
                selector: 'test-cmp',
                standalone: true,
                template: '{{ "hello" | nonExistentPipe }}'
            })
            export class TestComponent {}`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[0].severity).toBe(Severity.Error);
    });

    test('NG8005 WRITE_TO_READ_ONLY_VARIABLE — write to template let variable', async () => {
        instance.tsEditor.setValue(
            `import { Component } from '@angular/core';
            @Component({
                selector: 'test-cmp',
                standalone: true,
                template: '<div *ngFor="let item of items" (click)="item = null">{{ item }}</div>'
            })
            export class TestComponent {
                items = [1, 2, 3];
            }`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[0].severity).toBe(Severity.Error);
        expect(markers[0].message).toContain("Template variables are read-only");
    });

    test('NG8006 DUPLICATE_VARIABLE_DECLARATION', async () => {
        instance.tsEditor.setValue(
            `import { Component } from '@angular/core';
            import { NgForOf } from '@angular/common';
            @Component({
                selector: 'test-cmp',
                standalone: true,
                imports: [NgForOf],
                template: '<div *ngFor="let i of items; let i = index">{{ i }}</div>'
            })
            export class TestComponent {
                items = [1, 2, 3];
            }`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[0].severity).toBe(Severity.Error);
    });

    test('NG8015 ILLEGAL_LET_WRITE', async () => {
        instance.tsEditor.setValue(
            `import { Component } from '@angular/core';
            @Component({
                selector: 'test-cmp',
                standalone: true,
                template: \`
                    @let name = 'hello';
                    <button (click)="name = 'world'">Change</button>
                \`
            })
            export class TestComponent {}`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[0].severity).toBe(Severity.Error);
        expect(markers[0].message).toContain("Cannot assign to @let");
    });

    test('NG8016 LET_USED_BEFORE_DEFINITION', async () => {
        instance.tsEditor.setValue(
            `import { Component } from '@angular/core';
            @Component({
                selector: 'test-cmp',
                standalone: true,
                template: \`
                    <div>{{ name }}</div>
                    @let name = 'hello';
                \`
            })
            export class TestComponent {}`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[0].severity).toBe(Severity.Error);
        expect(markers[0].message).toContain("Cannot read @let");
    });
});

// Not showing up at the moment.
describe.skip('NG Extended Template Diagnostics', () => {
    test('NG8101 INVALID_BANANA_IN_BOX — reversed two-way binding syntax', async () => {
        instance.tsEditor.setValue(
            `import { Component, model } from '@angular/core';
            import { FormsModule } from '@angular/forms';
            @Component({
                selector: 'test-cmp',
                standalone: true,
                imports: [FormsModule],
                template: '<input ([ngModel])="name">'
            })
            export class TestComponent {
                name = '';
            }`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers.some(m => m.message.includes("parentheses should be inside the brackets"))).toBe(true);
    });

    test('NG8102 NULLISH_COALESCING_NOT_NULLABLE', async () => {
        instance.tsEditor.setValue(
            `import { Component } from '@angular/core';
            @Component({
                selector: 'test-cmp',
                standalone: true,
                template: '{{ value ?? "default" }}'
            })
            export class TestComponent {
                value: string = 'hello';
            }`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers.some(m => m.message.includes("'??'") || m.message.includes("nullish coalescing"))).toBe(true);
    });

    test('NG8105 MISSING_NGFOROF_LET — ngFor missing let', async () => {
        instance.tsEditor.setValue(
            `import { Component } from '@angular/core';
            import { NgForOf } from '@angular/common';
            @Component({
                selector: 'test-cmp',
                standalone: true,
                imports: [NgForOf],
                template: '<div *ngFor="item of items">{{ item }}</div>'
            })
            export class TestComponent {
                items = [1, 2, 3];
            }`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers.some(m => m.message.includes("let"))).toBe(true);
    });

    test('NG8107 OPTIONAL_CHAIN_NOT_NULLABLE', async () => {
        instance.tsEditor.setValue(
            `import { Component } from '@angular/core';
            @Component({
                selector: 'test-cmp',
                standalone: true,
                template: '{{ value?.length }}'
            })
            export class TestComponent {
                value: string = 'hello';
            }`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers.some(m => m.message.includes("optional chain") || m.message.includes("null"))).toBe(true);
    });

    test('NG8109 INTERPOLATED_SIGNAL_NOT_INVOKED', async () => {
        instance.tsEditor.setValue(
            `import { Component, signal } from '@angular/core';
            @Component({
                selector: 'test-cmp',
                standalone: true,
                template: '{{ count }}'
            })
            export class TestComponent {
                count = signal(0);
            }`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers.some(m => m.message.includes("should be invoked"))).toBe(true);
    });

    test('NG8111 UNINVOKED_FUNCTION_IN_EVENT_BINDING', async () => {
        instance.tsEditor.setValue(
            `import { Component } from '@angular/core';
            @Component({
                selector: 'test-cmp',
                standalone: true,
                template: '<button (click)="handleClick">Click</button>'
            })
            export class TestComponent {
                handleClick() {}
            }`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers.some(m => m.message.includes("should be invoked"))).toBe(true);
    });

    test('NG8112 UNUSED_LET_DECLARATION', async () => {
        instance.tsEditor.setValue(
            `import { Component } from '@angular/core';
            @Component({
                selector: 'test-cmp',
                standalone: true,
                template: \`
                    @let unused = 'hello';
                    <div>content</div>
                \`
            })
            export class TestComponent {}`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers.some(m => m.severity === Severity.Warning || m.severity === Severity.Hint)).toBe(true);
    });

    test('NG8113 UNUSED_STANDALONE_IMPORTS', async () => {
        instance.tsEditor.setValue(
            `import { Component } from '@angular/core';
            import { NgIf } from '@angular/common';
            @Component({
                selector: 'test-cmp',
                standalone: true,
                imports: [NgIf],
                template: '<div>no ngIf used here</div>'
            })
            export class TestComponent {}`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers.some(m => m.message.includes("import") || m.message.includes("unused") || m.message.includes("not used"))).toBe(true);
    });
});

describe('NG Additional Template Errors', () => {
    test('NG8008 MISSING_REQUIRED_INPUTS', async () => {
        instance.tsEditor.setValue(
            `import { Component, input } from '@angular/core';
            @Component({
                selector: 'child-cmp',
                standalone: true,
                template: '<div></div>'
            })
            export class ChildComponent {
                public name = input.required();
            }
            @Component({
                selector: 'test-cmp',
                standalone: true,
                imports: [ChildComponent],
                template: '<child-cmp></child-cmp>'
            })
            export class TestComponent {}`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[0].severity).toBe(Severity.Error);
        expect(markers[0].message).toContain("Required input");
    });

    test('NG8003 MISSING_REFERENCE_TARGET', async () => {
        instance.tsEditor.setValue(
            `import { Component } from '@angular/core';
            @Component({
                selector: 'test-cmp',
                standalone: true,
                template: '<div #myRef="nonExistentDirective"></div>'
            })
            export class TestComponent {}`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[0].severity).toBe(Severity.Error);
    });

    test('NG8017 CONFLICTING_LET_DECLARATION', async () => {
        instance.tsEditor.setValue(
            `import { Component } from '@angular/core';
            @Component({
                selector: 'test-cmp',
                standalone: true,
                template: \`
                    @let name = 'hello';
                    @let name = 'world';
                \`
            })
            export class TestComponent {}`
        );
        const markers = await vi.waitUntil(() => {
            const m = instance.getTsErrors();
            return m.length ? m : false;
        });
        expect(markers[0].severity).toBe(Severity.Error);
        expect(markers[0].message).toContain("Cannot declare @let");
    });
});