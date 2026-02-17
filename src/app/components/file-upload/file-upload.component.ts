import { Component, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-file-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.css']
})
export class FileUploadComponent {
  @Output() onFileLoaded = new EventEmitter<string>();
  @Output() onFileRemoved = new EventEmitter<void>();
  
  fileName: string = '';
  private currentFile: File | null = null;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  isDragOver: boolean = false;

  removeFile() {
    this.fileName = '';
    this.currentFile = null;
    this.onFileRemoved.emit();
    try {
      if (this.fileInput && this.fileInput.nativeElement) {
        this.fileInput.nativeElement.value = '';
      }
    } catch (e) {
      // ignore if ViewChild not initialized
    }
  }

  openFileDialog() {
    this.fileInput?.nativeElement.click();
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
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragEnd() {
    this.isDragOver = false;
  }

  onDragEnter(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
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
