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
    print(path)
    os.makedirs('./' + path, exist_ok=True)
    
        
def main():
    url = 'http://ncert.nic.in/textbook.php'

    driver = webdriver.Chrome()
    driver.get(url)

    #let the page load
    # time.sleep(2)
    
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
          print(book_name)
          time.sleep(4)
          go_button = driver.find_element(By.XPATH, "//input[@name='button' and @value='Go']")
          go_button.click()
          time.sleep(20)
          pdf_link = driver.find_element(By.TAG_NAME, "a").get_attribute("href")
 
if __name__ == '__main__':
  main()
