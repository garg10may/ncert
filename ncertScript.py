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
from pprint import pprint
from selenium.webdriver.support.ui import Select


def get_soup(url):
    response = requests.get(url)
    return BeautifulSoup(response.text, "html.parser")


def create_directory(path):
    os.makedirs("./" + path, exist_ok=True)


def extract_images_and_pdfs(zip_file, output_dir):
    with zipfile.ZipFile(zip_file, "r") as zip_ref:
        zip_ref.extractall(output_dir)


def convert_image_to_pdf(image_path, output_pdf_path):
    image = Image.open(image_path)
    image.save(output_pdf_path, "PDF", resolution=100.0, save_all=True)


def combine_images_and_pdfs(dir, output_file):
    cover_image = None
    ps_pdf = None
    chapter_pdfs = []

    files = os.listdir(dir)

    for file in files:
        if file.endswith(".JPG"):
            cover_image = file
        elif file.endswith("ps.pdf"):
            ps_pdf = file
        elif (
            file.endswith(".pdf")
            and not file.endswith("ps.pdf")
            and not file.endswith("cover.pdf")
        ):
            chapter_pdfs.append(file)

    if cover_image:
        convert_image_to_pdf(
            os.path.join(dir, cover_image), os.path.join(dir, "cover.pdf")
        )
    # for names like gesc101.pdf, sort by the last two digits
    chapter_pdfs.sort(key=lambda x: int(x.split(".")[0][-2:]))
    merger = PdfMerger()

    if cover_image:
        all_pdfs = ["cover.pdf"] + [ps_pdf] + chapter_pdfs
    else:
        all_pdfs = [ps_pdf] + chapter_pdfs

    for file in all_pdfs:
        file_path = os.path.join(dir, file)
        merger.append(file_path)

    # write to parent directory
    # subject_dir = dir.split('/')[:-1]
    subject_dir = "\\".join(dir.split("\\")[:-1])
    # import pdb
    # pdb.set_trace()
    merger.write(os.path.join(subject_dir, output_file))
    # merger.write(output_file)
    merger.close()
    # delete book folder
    shutil.rmtree(dir)


def download_pdf(url, path):
    try:
        urllib.request.urlretrieve(url, path)
    except Exception as e:
        print(f"Error downloading {url}: {e}")


def get_class_subject_book_mapping(driver):
    #form a dic of class, subject and book
    class_subject_book_mapping = {}
    # [1:] to skip the first option which is "Select Class"
    # class 1 and 2 seems to have bug where mathematics is repeated, so skipping them
    class_select = driver.find_element(By.NAME, "tclass")
    class_options = class_select.find_elements(By.TAG_NAME, "option")[3:4]
    #remove '' from the list
    class_options = [class_option for class_option in class_options if class_option.text != '']
    for class_option in class_options:
        class_option.click()
        subject_select = driver.find_element(By.NAME, "tsubject")
        subject_options = subject_select.find_elements(By.TAG_NAME, "option")[1:]
        #remove '' from the list
        subject_options = [subject_option for subject_option in subject_options if subject_option.text != '']
        #initialize the subject list
        class_subject_book_mapping[class_option.text] = {subject_option.text: [] for subject_option in subject_options }
        for subject_option in subject_options:
            subject_option.click()
            book_select = driver.find_element(By.NAME, "tbook")
            book_options = book_select.find_elements(By.TAG_NAME, "option")[1:]
            book_options = [book_option for book_option in book_options if book_option.text != '']
            class_subject_book_mapping[class_option.text][subject_option.text] = [book_option.text for book_option in book_options]
    
    return class_subject_book_mapping


def main():
    url = "http://ncert.nic.in/textbook.php"

    driver = webdriver.Chrome()
    driver.get(url)

    class_subject_book_mapping = get_class_subject_book_mapping(driver)   

    for class_name, subject_book_mapping in class_subject_book_mapping.items():
        class_dir = os.path.join("books", class_name)
        create_directory(class_dir)

        for subject_name, book_names in subject_book_mapping.items():
            subject_dir = os.path.join(class_dir, subject_name)
            create_directory(subject_dir)

            for book_name in book_names:

                #check if the book is already downloaded
                if os.path.exists(os.path.join(subject_dir, book_name + ".pdf")):
                    print(f"{class_name} {subject_name} {book_name} already downloaded")
                    continue
                
                print(f"Downloading {class_name} {subject_name} {book_name}")
                book_dir = os.path.join(subject_dir, book_name)
                create_directory(book_dir)

                class_select = Select(driver.find_element(By.NAME, "tclass"))
                class_select.select_by_visible_text(class_name)

                subject_select = Select(driver.find_element(By.NAME, "tsubject"))
                subject_select.select_by_visible_text(subject_name)

                book_select = Select(driver.find_element(By.NAME, "tbook"))
                book_select.select_by_visible_text(book_name)

                go_button = driver.find_element(By.XPATH, "//input[@name='button' and @value='Go']")
                go_button.click()

                wait = WebDriverWait(driver, 5)
                element = wait.until(
                    EC.element_to_be_clickable(
                        (By.XPATH, "//a[contains(., 'Download complete book')]")
                    )
                )

                book_link = element.get_attribute("href")

                zip_file_path = os.path.join(book_dir, book_name + ".zip")
                download_pdf(book_link, zip_file_path)
                extract_images_and_pdfs(zip_file_path, book_dir)
                os.remove(zip_file_path)
                combine_images_and_pdfs(book_dir, book_name + ".pdf")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Error: {e}")
