import torch.nn as nn
import torch

class BurnoutPredictor():
    def __init__(self):
        super(BurnoutPredictor, self).__init__()

        input_dim = 768 + 1

        self.fc1 = nn.Linear(input_dim, 256)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(0.3),
        self.fc2 = nn.Linear(256, 3)
    
    def forward(self, acoustic_emb, linguistic_val):
        fusion_vector = torch.cat((acoustic_emb, linguistic_val), dim=1)

        x = self.fc1(fusion_vector)
        x = self.relu(x)
        x = self.dropout(x)
        output = self.fc2(x)

        return output
