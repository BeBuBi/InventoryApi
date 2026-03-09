import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-multi-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="relative">
      <!-- Trigger button -->
      <button
        type="button"
        (click)="togglePanel($event)"
        [title]="buttonTitle"
        class="w-full text-xs border border-gray-300 rounded px-2 py-1 text-left focus:outline-none mt-1 bg-white flex items-center justify-between font-normal normal-case tracking-normal"
        [class.border-blue-400]="isOpen"
        [class.ring-1]="isOpen"
        [class.ring-blue-300]="isOpen">
        <span class="truncate text-gray-700 leading-4">{{ buttonLabel }}</span>
        <span class="ml-1 flex-shrink-0 text-gray-400 text-xs leading-4">&#9660;</span>
      </button>

      <!-- Dropdown panel -->
      <div *ngIf="isOpen"
           class="absolute z-50 mt-1 bg-white border border-gray-200 rounded shadow-lg min-w-max"
           style="min-width: 100%">

        <!-- Select All / Clear All row -->
        <div class="flex items-center gap-2 px-3 py-2 border-b border-gray-100 text-xs font-medium text-gray-600">
          <input
            type="checkbox"
            [checked]="allSelected"
            [indeterminate]="someSelected"
            (change)="toggleAll()"
            class="w-3.5 h-3.5 accent-blue-600 cursor-pointer flex-shrink-0"
            aria-label="Select all options"
          />
          <span class="cursor-pointer select-none" (click)="toggleAll()">
            {{ allSelected ? 'Clear all' : 'Select all' }}
          </span>
        </div>

        <!-- Options list -->
        <div class="max-h-48 overflow-y-auto">
          <label
            *ngFor="let opt of options; trackBy: trackByValue"
            class="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-xs text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              [checked]="isSelected(opt)"
              (change)="toggleOption(opt)"
              class="w-3.5 h-3.5 accent-blue-600 cursor-pointer flex-shrink-0"
            />
            <span class="select-none leading-4">{{ getLabel(opt) }}</span>
          </label>
          <div *ngIf="options.length === 0"
               class="px-3 py-2 text-xs text-gray-400 italic">No options available</div>
        </div>
      </div>
    </div>
  `
})
export class MultiSelectComponent {
  @Input() options: string[] = [];
  @Input() selected: string[] = [];
  @Input() placeholder = 'All';
  /** Optional label function — maps raw option values to human-readable display strings. */
  @Input() labelFn: ((value: string) => string) | null = null;
  @Output() selectedChange = new EventEmitter<string[]>();

  isOpen = false;

  constructor(private elementRef: ElementRef) {}

  // Close when a click lands outside this component's root element.
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen = false;
    }
  }

  togglePanel(event: MouseEvent): void {
    event.stopPropagation();
    this.isOpen = !this.isOpen;
  }

  getLabel(value: string): string {
    return this.labelFn ? this.labelFn(value) : value;
  }

  get buttonLabel(): string {
    if (this.selected.length === 0) return this.placeholder;
    if (this.selected.length > 2) return `${this.selected.length} selected`;
    return this.selected.map(v => this.getLabel(v)).join(', ');
  }

  get buttonTitle(): string {
    if (this.selected.length === 0) return this.placeholder;
    return this.selected.map(v => this.getLabel(v)).join(', ');
  }

  get allSelected(): boolean {
    return this.options.length > 0 && this.selected.length === this.options.length;
  }

  get someSelected(): boolean {
    return this.selected.length > 0 && this.selected.length < this.options.length;
  }

  isSelected(opt: string): boolean {
    return this.selected.includes(opt);
  }

  toggleOption(opt: string): void {
    const next = this.isSelected(opt)
      ? this.selected.filter(v => v !== opt)
      : [...this.selected, opt];
    this.selectedChange.emit(next);
  }

  toggleAll(): void {
    const next = this.allSelected ? [] : [...this.options];
    this.selectedChange.emit(next);
  }

  trackByValue(_index: number, value: string): string {
    return value;
  }
}
