import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-file-upload',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="!fileName" class="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <label class="flex items-center justify-center w-full cursor-pointer">
        <div class="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-600 rounded-lg p-6 hover:border-blue-500 transition">
          <svg class="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
          <p class="text-white font-semibold">Click to upload .log file</p>
          <p class="text-gray-400 text-sm">or drag and drop</p>
        </div>
        <input 
          #fileInput
          type="file" 
          accept=".log" 
          (change)="onFileSelected($event)"
          (drop)="onFileDropped($event)"
          (dragover)="onDragOver($event)"
          (dragend)="onDragEnd()"
          class="hidden" />
      </label>
    </div>
  `,
  styles: []
})
export class FileUploadComponent {
  @Output() onFileLoaded = new EventEmitter<string>();
  @Output() onFileRemoved = new EventEmitter<void>();
  
  fileName: string = '';
  private currentFile: File | null = null;

  removeFile() {
    this.fileName = '';
    this.currentFile = null;
    this.onFileRemoved.emit();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.processFile(file);
    }
  }

  onFileDropped(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  onDragEnd() {
    // Handle drag end if needed
  }

  private processFile(file: File) {
    if (!file.name.endsWith('.log')) {
      alert('Please upload a .log file');
      return;
    }

    this.currentFile = file;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const content = e.target.result;
      this.fileName = file.name;
      this.onFileLoaded.emit(content);
    };
    reader.readAsText(file);
  }
}
