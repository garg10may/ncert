import requests
from bs4 import BeautifulSoup
import os
import urllib.request
import re
from selenium import webdriver
from selenium.webdriver.common.by import By
import time
import shutil
import zipfile
from PIL import Image
from PyPDF2 import PdfMerger
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def get_soup(url):
    response = requests.get(url)
    return BeautifulSoup(response.text, 'html.parser')

def create_directory(path):
    os.makedirs('./' + path, exist_ok=True)
    
def extract_images_and_pdfs(zip_file, output_dir):
    with zipfile.ZipFile(zip_file, 'r') as zip_ref:
        zip_ref.extractall(output_dir)

def convert_image_to_pdf(image_path, output_pdf_path):
    image = Image.open(image_path)
    image.save(output_pdf_path, 'PDF', resolution=100.0, save_all=True)

def combine_images_and_pdfs(dir, output_file):
    cover_image = None
    ps_pdf = None
    chapter_pdfs = []

    files = os.listdir(dir)

    for file in files:
        if file.endswith('.JPG'):
            cover_image = file
        elif file.endswith('ps.pdf'):
            ps_pdf = file
        elif file.endswith('.pdf') and not file.endswith('ps.pdf') and not file.endswith('cover.pdf'):
            chapter_pdfs.append(file)

    if cover_image:
        convert_image_to_pdf(os.path.join(dir, cover_image), os.path.join(dir, 'cover.pdf'))
    # for names like gesc101.pdf, sort by the last two digits
    print(chapter_pdfs)
    chapter_pdfs.sort(key=lambda x: int(x.split('.')[0][-2:]))
    merger = PdfMerger()

    if cover_image:
        all_pdfs = ['cover.pdf'] + [ps_pdf] + chapter_pdfs
    else:
        all_pdfs = [ps_pdf] + chapter_pdfs
        
    
    for file in all_pdfs:
        file_path = os.path.join(dir, file)
        merger.append(file_path)

    #write to parent directory
    # subject_dir = dir.split('/')[:-1]
    subject_dir = '\\'.join(dir.split('\\')[:-1])
    # import pdb
    # pdb.set_trace()
    merger.write( os.path.join(subject_dir, output_file))
    # merger.write(output_file)
    merger.close()
    #delete book folder
    shutil.rmtree(dir)

def download_pdf(url, path):
    try:
        urllib.request.urlretrieve(url, path)
    except Exception as e:
        print(f'Error downloading {url}: {e}')
        
def main():
    url = 'http://ncert.nic.in/textbook.php'

    driver = webdriver.Chrome()
    driver.get(url)

    class_select = driver.find_element(By.NAME, 'tclass')
    for class_option in class_select.find_elements(By.TAG_NAME, 'option')[1:2]:
      class_name = class_option.text
      class_option.click()
      class_dir = os.path.join('books', class_name)
      create_directory(class_dir)

      subject_select = driver.find_element(By.NAME, 'tsubject')
      for subject_option in subject_select.find_elements(By.TAG_NAME, 'option')[1:2]:
        subject_name = subject_option.text
        subject_option.click()
        subject_dir = os.path.join(class_dir, subject_name)
        create_directory(subject_dir)

        book_select = driver.find_element(By.NAME, 'tbook')
        for book_option in book_select.find_elements(By.TAG_NAME, 'option')[1:2]:
          book_name = book_option.text
          book_option.click()
          go_button = driver.find_element(By.XPATH, "//input[@name='button' and @value='Go']")
          go_button.click()

          wait = WebDriverWait(driver, 10)
          element = wait.until(EC.element_to_be_clickable((By.XPATH, "//a[contains(., 'Download complete book')]")))
          book_link = element.get_attribute("href")
          book_dir = os.path.join(subject_dir, book_name)
          create_directory(book_dir)
          download_pdf(book_link, os.path.join(book_dir, book_name + '.zip'))
          driver.back()

          zip_file = os.path.join(book_dir, book_name + '.zip')
          extract_images_and_pdfs(zip_file, book_dir)
          #delete zip file
          os.remove(zip_file)
          combine_images_and_pdfs(book_dir, os.path.join(book_name + '.pdf'))
            
 
if __name__ == '__main__':
  main()
