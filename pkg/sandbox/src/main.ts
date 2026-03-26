import { createEditors } from "./app";

const htmlElement = document.getElementById('html-editor') as HTMLElement;
const tsElement = document.getElementById('ts-editor') as HTMLElement;

if (!htmlElement || !tsElement) {
    throw new Error('Missing elements');
}

const {tsEditor, htmlEditor} = createEditors(htmlElement, tsElement);

tsEditor.setValue(
`import { Component } from '@angular/core';

@Component({
    selector: 'app-hello',
    templateUrl: './app.html',
})
export class HelloComponent {
    title = 'Hello Angular';
}`);

htmlEditor.setValue(
`<div>
    <h1>{{ title }}</h1>
    <h2>{{ subtitle }}</h2>
</div>`);