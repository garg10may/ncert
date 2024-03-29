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
import threading
import pickle
from concurrent.futures import ThreadPoolExecutor   


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

    #books can have cover image, prelims (ps), chapters(01, 02...), answers(an), brainteasers(bt), excercise(ex), 
    # perisist(pr) -> parisistam something in sanskrit, just append to the end
    # appendix -> Appendix I & II
    # ix -> Appendix
    # rf -> references
    # qa -> question/answers
    # lp -> lekakh parichay
    # a1 -> answers 1
    # a2 -> answers 2
    # gs -> glossary
    # an -> answers
    # in -> index (in urdu books)
    # gl
    # dr 
    # sk -> sabdkosh
    

    cover_image, ps_pdf, an_pdf, bt_pdf, ex_pdf, pr_pdf, appendix_pdf, rf_pdf = '', '', '', '', '', '', '', ''
    qa_pdf, ix_pdf, in_pdf, lp_pdf, a1_pdf, a2_pdf, gs_pdf, an_pdf = '', '', '', '', '', '', '', ''
    for file in files:
        if file.endswith(".JPG"):
            cover_image = file
        elif file.endswith("cc.pdf"): #pdf with the cover image
            #sometimes there's both .jpg and cc.pdf, in that case ignore .jpg file
            #ignore for now
            pass
        elif file.endswith("gl.pdf") or file.endswith("dr.pdf") or file.endswith("in.pdf") \
            or file.endswith("sk.pdf") or file.endswith("sr.pdf") or file.endswith("k1.pdf") \
                or file.endswith("sp.pdf"):
            pass
        elif file.endswith("ps.pdf"):
            ps_pdf = file
        elif file.endswith("an.pdf"):
            an_pdf = file
        elif file.endswith("bt.pdf"):
            bt_pdf = file
        elif file.endswith("ex.pdf"):
            ex_pdf = file
        elif file.endswith("pr.pdf"):
            ps_pdf = file
        elif file.endswith("II.pdf"):
            appendix_pdf = file
        elif file.endswith("rf.pdf"):
            rf_pdf = file
        elif file.endswith("qa.pdf"):
            qa_pdf = file
        elif file.endswith("ix.pdf"):
            ix_pdf = file
        elif file.endswith("lp.pdf"):
            lp_pdf = file
        elif file.endswith("a1.pdf"):
            a1_pdf = file
        elif file.endswith("a2.pdf"):
            a2_pdf = file
        elif file.endswith("gs.pdf"):
            gl_pdf = file
        elif file.endswith("an.pdf"):
            an_pdf = file
        elif file.endswith(".pdf"):
            #ensure last two are digits
            if file[-6].isdigit() and file[-5].isdigit():
                chapter_pdfs.append(file)
        

    if cover_image:
        convert_image_to_pdf(
            os.path.join(dir, cover_image), os.path.join(dir, "cover.pdf")
        )

    # for names like gesc101.pdf, sort by the last two digits
    chapter_pdfs.sort(key=lambda x: int(x.split(".")[0][-2:]))
    merger = PdfMerger()

    
    all_pdfs = [ps_pdf] + chapter_pdfs
    if cover_image:
        all_pdfs = ["cover.pdf"] + all_pdfs 
    if an_pdf and bt_pdf:
        all_pdfs = all_pdfs + [an_pdf] + [bt_pdf]
    if ex_pdf:
        all_pdfs = all_pdfs + [ex_pdf]
    if pr_pdf:
        all_pdfs = all_pdfs + [pr_pdf]
    if appendix_pdf:
        all_pdfs = all_pdfs + [appendix_pdf]
    if rf_pdf:
        all_pdfs = all_pdfs + [rf_pdf]
    if qa_pdf:
        all_pdfs = all_pdfs + [qa_pdf]
    if ix_pdf:
        all_pdfs = all_pdfs + [ix_pdf]
    if lp_pdf:
        all_pdfs = all_pdfs + [lp_pdf]
    if an_pdf:
        all_pdfs = all_pdfs + [an_pdf]
    if a1_pdf:
        all_pdfs = all_pdfs + [a1_pdf]
    if a2_pdf:
        all_pdfs = all_pdfs + [a2_pdf]
    if gs_pdf:
        all_pdfs = all_pdfs + [gs_pdf]
        

    for file in all_pdfs:
        file_path = os.path.join(dir, file)
        merger.append(file_path)

    subject_dir = "\\".join(dir.split("\\")[:-1])
    print(f"Combining {output_file}")   
    print(f'Subject dir: {subject_dir}')
    merger.write(os.path.join(subject_dir, output_file))
    merger.close()
    shutil.rmtree(dir)


def download_pdf(url, path):
    try:
        urllib.request.urlretrieve(url, path)
    except Exception as e:
        print(f"Error downloading {url}: {e}")


def get_class_subject_book_mapping(driver):
    # form a dic of class, subject and book
    class_subject_book_mapping = {}
    # [1:] to skip the first option which is "Select Class"
    # class 1 and 2 seems to have bug where mathematics is repeated, so skipping them
    class_select = driver.find_element(By.NAME, "tclass")
    class_options = class_select.find_elements(By.TAG_NAME, "option")[3:]
    # remove '' from the list
    class_options = [
        class_option for class_option in class_options if class_option.text != ""
    ]
    for class_option in class_options:
        class_option.click()
        subject_select = driver.find_element(By.NAME, "tsubject")
        subject_options = subject_select.find_elements(By.TAG_NAME, "option")[1:]
        # remove '' from the list
        subject_options = [
            subject_option
            for subject_option in subject_options
            if subject_option.text != ""
        ]
        # initialize the subject list
        class_subject_book_mapping[class_option.text] = {
            subject_option.text: [] for subject_option in subject_options
        }
        for subject_option in subject_options:
            subject_option.click()
            book_select = driver.find_element(By.NAME, "tbook")
            book_options = book_select.find_elements(By.TAG_NAME, "option")[1:]
            book_options = [
                book_option for book_option in book_options if book_option.text != ""
            ]
            class_subject_book_mapping[class_option.text][subject_option.text] = [
                book_option.text for book_option in book_options
            ]

    with open("class_subject_book_mapping.pkl", "wb") as f:
        pickle.dump(class_subject_book_mapping, f)
        
    return class_subject_book_mapping


def process_book(driver, class_name, subject_name, book_name, subject_dir, book_dir):
    print(f"Downloading {class_name} {subject_name} {book_name}")

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

    #put this code in thread
    def extract_and_combine_book():
        extract_images_and_pdfs(zip_file_path, book_dir)
        # os.remove(zip_file_path)
        combine_images_and_pdfs(book_dir, book_name + ".pdf")

    thread = threading.Thread(target=extract_and_combine_book)
    thread.start()

def load_class_subject_book_mapping():
    try:
        with open("class_subject_book_mapping.pkl", "rb") as f:
            return pickle.load(f)
    except:
        return None

def main():
    url = "http://ncert.nic.in/textbook.php"

    driver = webdriver.Chrome()
    driver.get(url)

    class_subject_book_mapping = load_class_subject_book_mapping()
    if class_subject_book_mapping is None:
        class_subject_book_mapping = get_class_subject_book_mapping(driver)

    for class_name, subject_book_mapping in class_subject_book_mapping.items():
        for subject_name, book_names in subject_book_mapping.items():
            for book_name in book_names:

                class_dir = os.path.join("books", class_name)
                subject_dir = os.path.join(class_dir, subject_name)
                book_dir = os.path.join(subject_dir, book_name)

                # check if the book is already downloaded
                if os.path.exists(os.path.join(subject_dir, book_name + ".pdf")):
                    print(f"{class_name} {subject_name} {book_name} already downloaded")
                    continue

                create_directory(book_dir)
                process_book(driver, class_name, subject_name, book_name, subject_dir, book_dir)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Error: {e}")
