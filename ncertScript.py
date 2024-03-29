#Write a script for site https://ncert.nic.in/textbook.php to download all the books of class 1 to 12.
#The script should download all the books of all the subjects of all the classes.
#The script should create a directory structure like:
#ncert/
#    class1/
#        subject1/
#            book1.pdf
#            book2.pdf
#        subject2/
#            book1.pdf
#            book2.pdf
#    class2/
#        subject1/
#            book1.pdf
#            book2.pdf
#        subject2/
#            book1.pdf
#            book2.pdf
#    .
#    .
#    .

import requests
from bs4 import BeautifulSoup
import os
import urllib.request
import re
from selenium import webdriver
from selenium.webdriver.common.by import By
import time

def get_soup(url):
    response = requests.get(url)
    return BeautifulSoup(response.text, 'html.parser')
  
def get_classes(soup):
    class_selector = soup.find('select', {'name': 'tclass'})
    return class_selector.find_all('option')[1:]
  
def get_subjects(soup):
    subjects = soup.find_all('div', class_='tab-content')
    return subjects
  
def get_books(soup):
    books = soup.find_all('div', class_='tab-content')
    return books
  
def get_pdf_links(soup):
    pdf_links = []
    links = soup.find_all('a')
    for link in links:
        if link.get('href') and link.get('href').endswith('.pdf'):
            pdf_links.append(link.get('href'))
    return pdf_links
  
def download_pdf(url, path):
    try:
        urllib.request.urlretrieve(url, path)
    except Exception as e:
        print(f'Error downloading {url}: {e}')


def create_directory(path):
    os.makedirs(path, exist_ok=True)
    
        
def main():
    url = 'http://ncert.nic.in/textbook.php'

    driver = webdriver.Chrome()
    driver.get(url)

    #let the page load
    # time.sleep(5)
    
    class_select = driver.find_element(By.NAME, 'tclass')
    for class_option in class_select.find_elements(By.TAG_NAME, 'option')[1:]:
      class_option.click()
      print(class_option.text)

      subject_select = driver.find_element(By.NAME, 'tsubject')
      for subject_option in subject_select.find_elements(By.TAG_NAME, 'option')[1:]:
        subject_option.click()
        print(subject_option.text)

        book_select = driver.find_element(By.NAME, 'tbook')
        for book_option in book_select.find_elements(By.TAG_NAME, 'option')[1:]:
          book_option.click()
          print(book_option.text)

          # pdf_links = driver.find_elements(By.TAG_NAME, 'a')
          # for i, pdf_link in enumerate(pdf_links):
          #   if pdf_link.get_attribute('href').endswith('.pdf'):
          #     pdf_name = f'{book_option.text}_{i+1}.pdf'
          #     pdf_path = os.path.join('ncert', class_option.text, subject_option.text, pdf_name)
          #     download_pdf(pdf_link.get_attribute('href'), pdf_path)
          #     print(f'Downloaded {pdf_path}')
    # soup = get_soup(url)
    # classes = get_classes(soup)
    # print(classes)
    
    # class_selector = soup.find('select', {'name': 'tclass'})
    # subjects_selector = soup.find('select', {'name': 'tsubject'})
    # books_selector = soup.find('select', {'name': 'tbook'})
    
    # for class_option in class_selector.find_all('option')[1:]:
    #   class_name = class_option.text.strip()
    #   print(class_option)
    #   class_dir = os.path.join('ncert', class_name)
    #   create_directory(class_dir)

      #subject is a dynmaic dropdown, so we need to get the subject options for each class
      #for each class, we get the subject options and then iterate over them to get the books
      #we would need to create automation to select the subject and then get the books
      #use selenium for this
      #for now, we will just get the subject options and print them
      
      

      # for subject_option in subjects_selector.find_all('option')[1:]:
      #   subject_name = subject_option.text.strip()
      #   print(subject_option)
      #   subject_dir = os.path.join(class_dir, subject_name)
      #   create_directory(subject_dir)

        # for book_option in books_selector.find_all('option')[1:]:
        #   book_name = book_option.text.strip()
        #   print(book_option)
        #   book_dir = os.path.join(subject_dir, book_name)
        #   create_directory(book_dir)

        #   book_url = f'http://ncert.nic.in/textbook.php?tclass={class_option.get("value")}&tsubject={subject_option.get("value")}&tbook={book_option.get("value")}'
        #   book_soup = get_soup(book_url)
        #   pdf_links = get_pdf_links(book_soup)
        #   for i, pdf_link in enumerate(pdf_links):
        #     pdf_name = f'{book_name}_{i+1}.pdf'
        #     pdf_path = os.path.join(book_dir, pdf_name)
        #     download_pdf(pdf_link, pdf_path)
        #     print(f'Downloaded {pdf_path}')
      
    # for class_ in classes:
    #     print(class_)
    #     class_name = class_.find('h3').text
    #     class_name = class_name.replace(' ', '_')
    #     class_path = os.path.join('ncert', class_name)
    #     os.makedirs(class_path, exist_ok=True)
    #     subjects = get_subjects(class_)
    #     for subject in subjects:
    #         subject_name = subject.find('h4').text
    #         subject_name = subject_name.replace(' ', '_')
    #         subject_path = os.path.join(class_path, subject_name)
    #         os.makedirs(subject_path, exist_ok=True)
    #         books = get_books(subject)
    #         for book in books:
    #             book_name = book.find('h5').text
    #             book_name = book_name.replace(' ', '_')
    #             pdf_links = get_pdf_links(book)
    #             for i, pdf_link in enumerate(pdf_links):
    #                 pdf_name = f'{book_name}_{i+1}.pdf'
    #                 pdf_path = os.path.join(subject_path, pdf_name)
    #                 download_pdf(pdf_link, pdf_path)
    #                 print(f'Downloaded {pdf_path}')
                    
if __name__ == '__main__':
  main()
